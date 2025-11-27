import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    loadProfile(session.user.id);
  };

  const loadProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileData) {
      // Load company separately if company_id exists
      if (profileData.company_id) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profileData.company_id)
          .single();
        
        setProfile({ ...profileData, companies: companyData });
        loadProjects(profileData.company_id);
      } else {
        setProfile(profileData);
        setShowCompanyDialog(true);
      }
    }
  };

  const loadProjects = async (companyId: string) => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (data) {
      setProjects(data);
    }
  };

  const handleSaveCompany = async () => {
    if (!companyName || !companyEmail) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: companyName,
          admin_email: companyEmail,
          created_by: user.id,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Update profile
      await supabase
        .from("profiles")
        .update({ company_id: company.id })
        .eq("id", user.id);

      setShowCompanyDialog(false);
      loadProfile(user.id);
      toast({
        title: "Company details saved",
        description: "Your company has been created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName) {
      toast({
        title: "Error",
        description: "Please enter a project name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name: projectName,
          description: projectDescription,
          company_id: profile.company_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setShowProjectDialog(false);
      setProjectName("");
      setProjectDescription("");
      navigate(`/dataset/${project.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">VisionM</h1>
          <div className="flex gap-4 items-center">
            <span className="text-sm text-muted-foreground">{profile?.email}</span>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome, {profile?.name}</h2>
          {profile?.companies && (
            <p className="text-muted-foreground">
              {profile.companies.name}
            </p>
          )}
        </div>

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-semibold">Your Projects</h3>
          <Button onClick={() => setShowProjectDialog(true)}>
            Create Project
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>{project.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/dataset/${project.id}`)}
                >
                  Manage Dataset
                </Button>
              </CardContent>
            </Card>
          ))}

          {projects.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">No projects yet. Create your first project!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Company Details Dialog */}
      <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
            <DialogDescription>
              Please provide your company information to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company Inc."
              />
            </div>
            <div>
              <Label htmlFor="company-email">Admin Email</Label>
              <Input
                id="company-email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="admin@company.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCompany} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter details for your new dataset project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Dataset Project"
              />
            </div>
            <div>
              <Label htmlFor="project-description">Description (Optional)</Label>
              <Textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe your project..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
