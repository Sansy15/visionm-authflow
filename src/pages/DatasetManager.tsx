import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

const DatasetManager = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [project, setProject] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [projectPassword, setProjectPassword] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentDataset, setCurrentDataset] = useState<any>(null);
  const [pollingDatasetId, setPollingDatasetId] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
    loadDatasets();
  }, [projectId]);

  useEffect(() => {
    if (pollingDatasetId) {
      const interval = setInterval(() => {
        checkDatasetStatus(pollingDatasetId);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [pollingDatasetId]);

  const loadProject = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (data) {
      setProject(data);
    }
  };

  const loadDatasets = async () => {
    const { data } = await supabase
      .from("datasets")
      .select("*, dataset_files(count)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data) {
      setDatasets(data);
    }
  };

  const checkDatasetStatus = async (datasetId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dataset-status/${datasetId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === "ready" || data.status === "failed") {
          setPollingDatasetId(null);
          setCurrentDataset(data);
          loadDatasets();
        }
      }
    } catch (error) {
      console.error("Error checking dataset status:", error);
    }
  };

  const handleAddUser = async () => {
    if (!userEmail || !projectPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      // Call edge function to hash password and send invite
      const { data, error } = await supabase.functions.invoke("invite-project-user", {
        body: {
          projectId,
          userEmail,
          projectPassword,
          invitedBy: user.id,
        },
      });

      if (error) throw error;

      setShowAddUserDialog(false);
      setUserEmail("");
      setProjectPassword("");
      toast({
        title: "Invitation sent",
        description: "The user will receive an email with project access instructions.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate files
    const validFiles = files.filter(file => {
      const ext = file.name.toLowerCase().split(".").pop();
      const isValid = ["jpg", "jpeg", "png", "txt"].includes(ext || "");
      const sizeOk = file.size <= 50 * 1024 * 1024; // 50MB

      if (!isValid) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
      }
      if (!sizeOk) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 50MB limit`,
          variant: "destructive",
        });
      }

      return isValid && sizeOk;
    });

    if (validFiles.length > 100) {
      toast({
        title: "Too many files",
        description: "Maximum 100 files per upload",
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(validFiles);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current max version for this project
      const { data: existingDatasets } = await supabase
        .from("datasets")
        .select("version")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1);

      let nextVersion = "v1";
      if (existingDatasets && existingDatasets.length > 0 && existingDatasets[0].version) {
        const currentVersion = existingDatasets[0].version;
        const versionNum = parseInt(currentVersion.replace("v", "")) || 0;
        nextVersion = `v${versionNum + 1}`;
      }

      const formData = new FormData();
      formData.append("company", project.company_id);
      formData.append("project", projectId || "");
      formData.append("version", nextVersion);
      
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      // Upload to /api/dataset/upload endpoint
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-dataset`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { datasetId } = await response.json();
      
      setPollingDatasetId(datasetId);
      setShowUploadDialog(false);
      setSelectedFiles([]);
      
      toast({
        title: "Upload started",
        description: `Your dataset (${nextVersion}) is being processed...`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">VisionM</h1>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">{project?.name}</h2>
            <p className="text-muted-foreground">{project?.description}</p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setShowAddUserDialog(true)}>
              Add User
            </Button>
            <Button onClick={() => setShowUploadDialog(true)}>
              Upload Dataset
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Datasets</CardTitle>
            <CardDescription>Uploaded datasets for this project</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((dataset) => (
                  <TableRow key={dataset.id}>
                    <TableCell>{dataset.version || "N/A"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        dataset.status === "ready" ? "bg-success/10 text-success" :
                        dataset.status === "failed" ? "bg-destructive/10 text-destructive" :
                        "bg-warning/10 text-warning"
                      }`}>
                        {dataset.status}
                      </span>
                    </TableCell>
                    <TableCell>{dataset.total_images}</TableCell>
                    <TableCell>{formatBytes(dataset.size_bytes)}</TableCell>
                    <TableCell>{new Date(dataset.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {datasets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No datasets uploaded yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {pollingDatasetId && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Processing Dataset</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={33} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  Your dataset is being processed. This may take a few moments...
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User to Project</DialogTitle>
            <DialogDescription>
              Invite a user to access this project with a secure password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="user-email">User Email</Label>
              <Input
                id="user-email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@company.com"
              />
            </div>
            <div>
              <Label htmlFor="project-password">Project Password</Label>
              <Input
                id="project-password"
                type="password"
                value={projectPassword}
                onChange={(e) => setProjectPassword(e.target.value)}
                placeholder="Secure password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Dataset</DialogTitle>
            <DialogDescription>
              Upload images or text files for your dataset. Max 100 files, 50MB each.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Files or Folder</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                Select Files or Folder
              </Button>
              {selectedFiles.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedFiles.length} files selected (Version will be auto-generated)
                </p>
              )}
            </div>
            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>
              Skip
            </Button>
            <Button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatasetManager;
