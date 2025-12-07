// src/pages/DatasetManager.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim();
const apiUrl = (path: string) => {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return base ? `${base}/${p}` : `/${p}`;
};

type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "failed";

interface DatasetMetadata {
  id: string;
  status?: string;
  totalImages?: number;
  sizeBytes?: number;
  thumbnailsGenerated?: boolean;
  trainCount?: number;
  valCount?: number;
  testCount?: number;
  folders?: Record<string, { images: number; labels: number }>;
  previews?: Array<{ path: string; url?: string; thumbUrl?: string; thumbData?: string }>;
}

interface StatusResponse {
  status: string;
  // any of these might be present depending on backend
  processed?: number;
  processedCount?: number;
  processed_files?: number;
  total?: number;
  totalImages?: number;
  total_files?: number;
  percent?: number;
  trainCount?: number;
  valCount?: number;
  testCount?: number;
}

interface VersionEntry {
  version?: string;
  datasetId: string;
  createdAt?: string;
  status?: string;
  [k: string]: any;
}

interface FileEntry {
  id: string;
  name: string;
  path: string;
  size?: number;
  mime?: string;
  folder?: string;
  thumbUrl?: string;
  url?: string;
}

const MAX_FILES = 5000;
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB - adjust if needed

const DatasetManager = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [version, setVersion] = useState<string>("");

  const [files, setFiles] = useState<File[]>([]);
  const [labelledFolderError, setLabelledFolderError] = useState<string | null>(null);
  const [unlabelledFolderError, setUnlabelledFolderError] = useState<string | null>(null);

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("Idle");
  const [statusPercent, setStatusPercent] = useState<number | null>(null);

  const [currentDatasetId, setCurrentDatasetId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  const [statusProgress, setStatusProgress] = useState<StatusResponse | null>(null);

  const [labelledOpen, setLabelledOpen] = useState<boolean>(false);
  const [unlabelledOpen, setUnlabelledOpen] = useState<boolean>(false);

  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedVersionDatasetId, setSelectedVersionDatasetId] = useState<string | null>(null);
  const [fileManifest, setFileManifest] = useState<FileEntry[]>([]);
  const [folderTree, setFolderTree] = useState<any | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string>>({});

  // ------- Auth header helper -------
  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  // ------- Init: load auth + project + company -------
  useEffect(() => {
    const init = async () => {
      if (!projectId) {
        toast({
          title: "Invalid URL",
          description: "Project ID is missing.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Wait for session before making any DB calls
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        navigate("/auth?mode=signin");
        return;
      }

      setUser(session.user);

      // DB request - Supabase client automatically includes Authorization header
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, name, company_id")
        .eq("id", projectId)
        .single();

      if (projectError || !projectData) {
        toast({
          title: "Project not found",
          description: "Unable to load this project.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setProject(projectData);

      if (projectData.company_id) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("name")
          .eq("id", projectData.company_id)
          .single();

        if (companyData?.name) {
          setCompanyName(companyData.name);
        }
      }
    };

    void init();
  }, [projectId, navigate, toast]);

  const displayProjectName = project?.name ?? "Unnamed Project";

  // ------- Build files from FileList: do NOT filter by extension; include all files -------
  const buildFilesFromFileList = (fileList: FileList): { files: File[] } => {
    const selectedFiles = Array.from(fileList);

    if (selectedFiles.length > MAX_FILES) {
      throw new Error(`You can upload at most ${MAX_FILES} files.`);
    }

    const validFiles: File[] = [];

    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`${file.name} exceeds ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB file size limit.`);
      }
      // preserve everything — don't filter by extension
      validFiles.push(file);
    }

    return { files: validFiles };
  };

  // ------- File selection -------
  const handleFilesSelected = (fileList: FileList | null, isLabelled: boolean = true) => {
    // Clear previous errors immediately for the appropriate input
    if (isLabelled) {
      setLabelledFolderError(null);
    } else {
      setUnlabelledFolderError(null);
    }

    if (!fileList || fileList.length === 0) {
      const errorMsg = "Please select a folder with files.";
      if (isLabelled) {
        setLabelledFolderError(errorMsg);
      } else {
        setUnlabelledFolderError(errorMsg);
      }
      toast({
        title: "Invalid selection",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    // Run validation immediately
    try {
      const selectedFiles = Array.from(fileList);

      // Check file count immediately
      if (selectedFiles.length > MAX_FILES) {
        const errorMsg = `You can upload at most ${MAX_FILES} files. Selected folder contains ${selectedFiles.length} files.`;
        if (isLabelled) {
          setLabelledFolderError(errorMsg);
        } else {
          setUnlabelledFolderError(errorMsg);
        }
        toast({
          title: "Too many files",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      // Check file sizes immediately
      const oversizedFiles: string[] = [];
      for (const file of selectedFiles) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          oversizedFiles.push(file.name);
        }
      }

      if (oversizedFiles.length > 0) {
        const maxSizeMB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
        const errorMsg = oversizedFiles.length === 1
          ? `${oversizedFiles[0]} exceeds ${maxSizeMB} MB file size limit.`
          : `${oversizedFiles.length} file(s) exceed ${maxSizeMB} MB file size limit.`;
        if (isLabelled) {
          setLabelledFolderError(errorMsg);
        } else {
          setUnlabelledFolderError(errorMsg);
        }
        toast({
          title: "File size limit exceeded",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      // All validations passed - process files
      const { files: validFiles } = buildFilesFromFileList(fileList);

      setFiles(validFiles);
      setStatusMessage(`Selected ${validFiles.length} files.`);
      setUploadStatus("idle");
      setMetadata(null);
      setStatusProgress(null);
      setStatusPercent(null);
      // Clear errors for both inputs on success
      setLabelledFolderError(null);
      setUnlabelledFolderError(null);
    } catch (err: any) {
      const errorMsg = err.message ?? "File selection failed.";
      if (isLabelled) {
        setLabelledFolderError(errorMsg);
      } else {
        setUnlabelledFolderError(errorMsg);
      }
      toast({
        title: "Invalid selection",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  // ------- Versions: GET /api/datasets?company&project -------
  const fetchVersions = async () => {
    try {
      if (!companyName || !displayProjectName) return;
      const headers = await getAuthHeaders();
      const q = new URLSearchParams({ company: companyName, project: displayProjectName });
      const url = apiUrl(`/datasets?${q.toString()}`);
      // console.log("fetchVersions ->", url);
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        console.warn("fetchVersions -> 404 or other:", res.status);
        return;
      }
      const json = await res.json();
      const items: any[] = (json as any).datasets || json;
      const normalized: VersionEntry[] = items.map((it: any) => ({
        version: it.version,
        datasetId: it.id || it.datasetId || it._id,
        createdAt: it.created_at || it.createdAt || it.created,
        status: it.status,
        ...it,
      }));
      setVersions(normalized);
    } catch (err) {
      console.warn("fetchVersions error:", err);
    }
  };

  useEffect(() => {
    if (companyName && displayProjectName) {
      void fetchVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, project]);

  // ------- File manifest pagination & fetch helpers -------
  const fetchFileManifest = async (datasetId: string, page = 1, limit = 1000) => {
    try {
      const headers = await getAuthHeaders();
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      const url = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/files?${qs.toString()}`);
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        throw new Error(`files fetch failed ${res.status}`);
      }
      const json = await res.json();
      const list: FileEntry[] = json.files || json.items || json;
      return { list, meta: json };
    } catch (err) {
      console.warn("fetchFileManifest error:", err);
      return { list: [] as FileEntry[], meta: null };
    }
  };

  const fetchAllFiles = async (datasetId: string) => {
    const all: FileEntry[] = [];
    let page = 1;
    const limit = 1000;
    while (true) {
      const { list } = await fetchFileManifest(datasetId, page, limit);
      if (!list || list.length === 0) break;
      all.push(...list);
      if (list.length < limit) break;
      page += 1;
    }
    return all;
  };

  const fetchFolderSummary = async (datasetId: string) => {
    try {
      const headers = await getAuthHeaders();
      const url = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/folders`);
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) return null;
      const json = await res.json();
      return json;
    } catch (err) {
      console.warn("fetchFolderSummary error:", err);
      return null;
    }
  };

  const buildTreeFromFiles = (filesList: FileEntry[]) => {
    const root: any = { type: "folder", name: "", children: [] };

    for (const f of filesList) {
      const parts = (f.path || f.name).split("/").filter(Boolean);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        if (isFile) {
          node.children.push({
            type: "file",
            name: part,
            path: f.path,
            fileId: f.id,
            thumbUrl: f.thumbUrl,
            url: f.url,
          });
        } else {
          let child = node.children.find((c: any) => c.type === "folder" && c.name === part);
          if (!child) {
            child = { type: "folder", name: part, children: [] };
            node.children.push(child);
          }
          node = child;
        }
      }
    }

    return root;
  };

  // ------- Helper: compute percent robustly from status object -------
  const computePercentFromStatus = (s: StatusResponse | null): number | null => {
    if (!s) return null;
    if (typeof s.percent === "number") {
      const p = Math.round(Math.max(0, Math.min(100, s.percent)));
      return p;
    }
    // try common field names for processed and total
    const processed = (s as any).processed ?? (s as any).processedCount ?? (s as any).processed_files ?? (s as any).processed_files_count;
    const total = (s as any).total ?? (s as any).totalImages ?? (s as any).total_files ?? (s as any).total_files_count;
    if (typeof processed === "number" && typeof total === "number" && total > 0) {
      const p = Math.round((processed / total) * 100);
      return Math.max(0, Math.min(100, p));
    }
    return null;
  };

  // ------- Poll dataset status (GET /dataset/:datasetId/status) -------
  const pollDatasetStatus = useCallback(
    async (datasetId: string) => {
      setUploadStatus("processing");
      setStatusMessage("Processing dataset...");

      const interval = setInterval(async () => {
        try {
          const headers = await getAuthHeaders();
          const url = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/status`);
          const res = await fetch(url, { method: "GET", headers });

          if (!res.ok) {
            throw new Error(`Status check failed with ${res.status}`);
          }

          const json: StatusResponse = await res.json();
          setStatusProgress(json);

          // compute percent and set to state (used by progress bar)
          const pct = computePercentFromStatus(json);
          setStatusPercent(pct);

          if (json.status === "ready" || json.status === "failed") {
            clearInterval(interval);

            if (json.status === "ready") {
              setUploadStatus("ready");
              setStatusMessage("Dataset is ready.");
              setStatusPercent(100);

              // fetch final metadata
              try {
                const headers2 = await getAuthHeaders();
                const metaUrl = apiUrl(`/dataset/${encodeURIComponent(datasetId)}`);
                const metaRes = await fetch(metaUrl, { headers: headers2 });
                if (metaRes.ok) {
                  const metaJson = await metaRes.json();
                  setMetadata(metaJson);
                }
              } catch (err) {
                console.warn("Failed to fetch final metadata:", err);
              }

              // fetch full file manifest and build tree
              try {
                const allFiles = await fetchAllFiles(datasetId);
                setFileManifest(allFiles || []);
                const tree = buildTreeFromFiles(allFiles || []);
                setFolderTree(tree);
              } catch (err) {
                console.warn("Failed to fetch files for tree after ready:", err);
              }
            } else {
              setUploadStatus("failed");
              setStatusMessage("Dataset processing failed.");
            }
          } else {
            // still processing, update the UI text if backend provides more detail
            setStatusMessage((prev) => {
              // if backend provides processed/total, show brief detail
              const processed = (json as any).processed ?? (json as any).processedCount ?? (json as any).processed_files;
              const total = (json as any).total ?? (json as any).totalImages ?? (json as any).total_files;
              if (typeof processed === "number" && typeof total === "number") {
                return `Processing — ${processed} / ${total}`;
              }
              return "Processing dataset on server...";
            });
          }
        } catch (err: any) {
          clearInterval(interval);
          setUploadStatus("failed");
          setStatusMessage("Failed to check dataset status.");
          setStatusPercent(null);
          toast({
            title: "Status error",
            description: err.message ?? "Could not check dataset status.",
            variant: "destructive",
          });
        }
      }, 3000);
    },
    [toast],
  );

  // ------- Upload handler (POST /dataset/upload) -------
  const handleUpload = async () => {
    if (!project) {
      toast({
        title: "Missing project",
        description: "Project information is missing.",
        variant: "destructive",
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select a folder with supported files first.",
        variant: "destructive",
      });
      return;
    }

    const projectName = displayProjectName;
    const company = companyName || "Unknown";

    try {
      setUploadStatus("uploading");
      setStatusMessage("Uploading files...");
      setStatusPercent(null);

      const formData = new FormData();
      formData.append("company", company);
      formData.append("project", projectName);
      if (version.trim()) formData.append("version", version.trim());

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Append every file with its relative path (preserve folder hierarchy)
      files.forEach((file) => {
        // @ts-ignore webkitRelativePath available in supported browsers
        const relPath = (file as any).webkitRelativePath || file.name;
        formData.append("files", file, relPath);
      });

      const uploadUrl = apiUrl("/dataset/upload");
      // console.log("upload ->", uploadUrl);
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Upload failed: ${res.status} - ${errorText}`);
      }

      const json = await res.json();
      const datasetId = json.datasetId || json.id;
      if (!datasetId) throw new Error("No datasetId returned from server.");

      setCurrentDatasetId(datasetId);
      setStatusProgress({
        status: json.status,
        totalImages: json.totalImages,
      });

      toast({
        title: "Upload queued",
        description: `Dataset ${datasetId} queued with ${json.totalImages} files.`,
      });

      // refresh versions
      await fetchVersions();

      // fetch folder summary and initial manifest if available
      try {
        const summary = await fetchFolderSummary(datasetId);
        if (summary) {
          setMetadata((prev) => ({ ...(prev ?? {}), ...summary }));
        }
      } catch (err) {
        console.warn("Failed to fetch folder summary:", err);
      }

      try {
        const allFiles = await fetchAllFiles(datasetId);
        setFileManifest(allFiles || []);
        setFolderTree(buildTreeFromFiles(allFiles || []));
      } catch (err) {
        console.warn("Failed to fetch initial files for tree:", err);
      }

      // start polling for server-side processing
      await pollDatasetStatus(datasetId);
    } catch (err: any) {
      setUploadStatus("failed");
      setStatusMessage("Upload failed.");
      setStatusPercent(null);
      toast({
        title: "Upload failed",
        description: err.message ?? "Something went wrong during upload.",
        variant: "destructive",
      });
    }
  };

  // ------- Select a version and load everything to resume work -------
  const onSelectVersion = async (datasetId: string) => {
    try {
      setSelectedVersionDatasetId(datasetId);

      try {
        const sum = await fetchFolderSummary(datasetId);
        if (sum) setMetadata((prev) => ({ ...(prev ?? {}), ...sum }));
      } catch (err) {
        console.warn("fetchFolderSummary failed for version select:", err);
      }

      try {
        const allFiles = await fetchAllFiles(datasetId);
        setFileManifest(allFiles || []);
        setFolderTree(buildTreeFromFiles(allFiles || []));
        const previews = (allFiles || []).slice(0, 50).map((f) => ({
          path: f.path,
          fileId: f.id,
          thumbUrl: f.thumbUrl,
          url: f.url,
        }));
        setMetadata((prev) => ({ ...(prev ?? {}), previews }));
      } catch (err) {
        console.warn("Failed to fetch files for selected version:", err);
      }

      // optionally fetch current status for that version to show progress
      try {
        const headers = await getAuthHeaders();
        const statusRes = await fetch(apiUrl(`/dataset/${encodeURIComponent(datasetId)}/status`), { method: "GET", headers });
        if (statusRes.ok) {
          const sjson = await statusRes.json();
          setStatusProgress(sjson);
          setStatusPercent(computePercentFromStatus(sjson));
          setUploadStatus(sjson.status === "processing" ? "processing" : sjson.status === "ready" ? "ready" : "idle");
          setStatusMessage(sjson.status === "processing" ? "Processing dataset..." : `Status: ${sjson.status}`);
        }
      } catch (err) {
        // non-fatal
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Could not load version contents",
        variant: "destructive",
      });
    }
  };

  // ------- Thumbnail helper: fetch protected thumbnail as blob if needed -------
  const fetchThumbnailAsObjectUrl = async (datasetId: string, fileId: string) => {
    const cacheKey = `${datasetId}:${fileId}`;
    if (thumbnailCache[cacheKey]) return thumbnailCache[cacheKey];

    try {
      const headers = await getAuthHeaders();
      const url = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(fileId)}/thumbnail`);
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) throw new Error("thumbnail fetch failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      setThumbnailCache((s) => ({ ...s, [cacheKey]: objUrl }));
      return objUrl;
    } catch (err) {
      console.warn("fetchThumbnailAsObjectUrl failed:", err);
      return null;
    }
  };

  const toggleExpanded = (path: string) => {
    setExpandedPaths((s) => ({ ...s, [path]: !s[path] }));
  };

  function TreeNode({ node, parentPath = "" }: { node: any; parentPath?: string }) {
    const path = parentPath ? `${parentPath}/${node.name}`.replace(/^\/+/, "") : node.name || "";
    const isFolder = node.type === "folder";

    if (isFolder) {
      const children: any[] = node.children || [];
      const expanded = !!expandedPaths[path];
      return (
        <div className="pl-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleExpanded(path)}>
            <span className="text-sm">{expanded ? "▾" : "▸"}</span>
            <span className="font-medium text-sm">{node.name || "(root)"}</span>
          </div>
          {expanded && (
            <div className="pl-4">
              {children.map((c: any, idx: number) => (
                <div key={idx}>
                  <TreeNode node={c} parentPath={path} />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      const datasetId = selectedVersionDatasetId || currentDatasetId;
      const thumbEndpoint = datasetId ? apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(node.fileId)}/thumbnail`) : null;
      const fileEndpoint = datasetId ? apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(node.fileId)}`) : "#";

      return (
        <div className="pl-6 py-1 flex items-center gap-3 text-xs">
          {node.thumbUrl ? (
            <img src={node.thumbUrl} className="w-12 h-8 object-cover rounded" alt={node.name} />
          ) : thumbEndpoint ? (
            <img
              src={thumbEndpoint}
              className="w-12 h-8 object-cover rounded"
              alt={node.name}
              onError={async (e) => {
                const objUrl = await fetchThumbnailAsObjectUrl(datasetId!, node.fileId);
                if (objUrl) {
                  (e.target as HTMLImageElement).src = objUrl;
                }
              }}
            />
          ) : null}

          <a href={node.url || fileEndpoint} target="_blank" rel="noreferrer" className="break-words">
            {node.name}
          </a>
        </div>
      );
    }
  }

  // ------- Render -------
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Upload dataset for {displayProjectName}</h2>
          {companyName && <p className="text-sm text-muted-foreground">{companyName}</p>}
        </div>
        <div className="w-64">
          <Label htmlFor="version" className="text-xs uppercase text-muted-foreground">Version (optional)</Label>
          <Input id="version" placeholder="e.g. v1" value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => { setLabelledOpen((p) => !p); setUnlabelledOpen(false); }}>
            <CardTitle className="flex justify-between items-center">
              <span>Labelled data</span>
              <span className="text-xs text-muted-foreground">{labelledOpen ? "▾" : "▸"}</span>
            </CardTitle>
            <CardDescription>Upload folder — entire structure will be preserved.</CardDescription>
          </CardHeader>
          {labelledOpen && (
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Select folder</Label>
                <div className="mt-2 flex items-center gap-4">
                  <Button type="button" variant="outline" onClick={() => { const input = document.getElementById("labelled-folder-input") as HTMLInputElement | null; input?.click(); }}>
                    Select Folder
                  </Button>
                  <span className="text-xs text-muted-foreground">All files & subfolders preserved • Max {MAX_FILES} files</span>
                </div>
                {labelledFolderError && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    {labelledFolderError}
                  </p>
                )}
                <input id="labelled-folder-input" type="file" multiple // @ts-ignore
                  webkitdirectory="true" className="hidden" onChange={(e) => handleFilesSelected(e.target.files, true)} />
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="cursor-pointer" onClick={() => { setUnlabelledOpen((p) => !p); setLabelledOpen(false); }}>
            <CardTitle className="flex justify-between items-center">
              <span>Unlabelled data</span>
              <span className="text-xs text-muted-foreground">{unlabelledOpen ? "▾" : "▸"}</span>
            </CardTitle>
            <CardDescription>Upload entire folder structure (images only or mixed).</CardDescription>
          </CardHeader>
          {unlabelledOpen && (
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Select folder</Label>
                <div className="mt-2 flex items-center gap-4">
                  <Button type="button" variant="outline" onClick={() => { const input = document.getElementById("unlabelled-folder-input") as HTMLInputElement | null; input?.click(); }}>
                    Select Folder
                  </Button>
                  <span className="text-xs text-muted-foreground">All files & subfolders preserved • Max {MAX_FILES} files</span>
                </div>
                {unlabelledFolderError && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    {unlabelledFolderError}
                  </p>
                )}
                <input id="unlabelled-folder-input" type="file" multiple // @ts-ignore
                  webkitdirectory="true" className="hidden" onChange={(e) => handleFilesSelected(e.target.files, false)} />
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={handleUpload} disabled={uploadStatus === "uploading" || files.length === 0}>
            {uploadStatus === "uploading" ? "Uploading..." : "Upload"}
          </Button>
          <div className="text-sm">
            <span className="font-medium">Status: </span>
            <span>{statusMessage}</span>
            {statusPercent !== null && (
              <span className="ml-3 font-mono text-xs"> {statusPercent}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar: reflects upload / processing progress.
          When server percent available, use it. Otherwise fall back to existing upload state visualization. */}
      <div className="w-full max-w-xl mb-4">
        <div className="h-2 rounded bg-muted overflow-hidden">
          <div
            className={`h-2 transition-all ${uploadStatus === "idle" ? "w-0" : "bg-primary"}`}
            style={{
              width:
                uploadStatus === "idle"
                  ? "0%"
                  : statusPercent !== null
                  ? `${statusPercent}%`
                  : uploadStatus === "uploading"
                  ? "20%"
                  : uploadStatus === "processing"
                  ? "60%"
                  : uploadStatus === "ready"
                  ? "100%"
                  : "100%",
              backgroundColor:
                uploadStatus === "ready" ? "#16a34a" /* emerald-500 */ : undefined,
            }}
          />
        </div>
      </div>

      {statusProgress && (
        <div className="text-sm text-muted-foreground mb-8 space-x-4">
          {typeof statusProgress.totalImages === "number" && <span>Total files: {statusProgress.totalImages}</span>}
          {typeof statusProgress.trainCount === "number" && <span>Train: {statusProgress.trainCount}</span>}
          {typeof statusProgress.valCount === "number" && <span>Val: {statusProgress.valCount}</span>}
          {typeof statusProgress.testCount === "number" && <span>Test: {statusProgress.testCount}</span>}
        </div>
      )}

      {metadata && (
        <div className="mt-4 max-w-2xl space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dataset summary</CardTitle>
              <CardDescription>ID: {metadata.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {typeof metadata.totalImages === "number" && <p><span className="font-medium">Total files: </span>{metadata.totalImages}</p>}
              {typeof metadata.sizeBytes === "number" && <p><span className="font-medium">Size: </span>{(metadata.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>}
              {typeof metadata.thumbnailsGenerated === "boolean" && <p><span className="font-medium">Thumbnails: </span>{metadata.thumbnailsGenerated ? "Generated" : "Pending"}</p>}
            </CardContent>
          </Card>

          {metadata.folders && (
            <Card>
              <CardHeader>
                <CardTitle>Folder breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.entries(metadata.folders).map(([folderName, stats]) => (
                  <p key={folderName}><span className="font-medium">{folderName}: </span>{stats.images} images, {stats.labels} labels</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Versions list */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Versions</CardTitle>
          <CardDescription>Click a version to view its stored subfolders & files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No versions yet.</div>
          ) : (
            <div className="space-y-1">
              {versions.map((v) => (
                <div key={v.datasetId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button className="text-left" onClick={() => onSelectVersion(v.datasetId)}>
                      <div className="font-medium">{v.version || v.datasetId}</div>
                      <div className="text-xs text-muted-foreground">{v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}</div>
                    </button>
                    {selectedVersionDatasetId === v.datasetId && <span className="text-xs text-primary"> (selected)</span>}
                  </div>
                  <div>
                    <a className="text-xs" href={apiUrl(`/dataset/${encodeURIComponent(v.datasetId)}/download`)} target="_blank" rel="noreferrer">Download</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Folder tree for selected version */}
      {folderTree && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Version contents</CardTitle>
            <CardDescription>Browse full stored folder tree</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm mb-3">Click folders to expand. Files link to their stored URLs or download endpoints.</div>
            <div><TreeNode node={folderTree} /></div>
          </CardContent>
        </Card>
      )}

      {/* Previews (server-provided) */}
      {metadata?.previews && metadata.previews.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Preview samples</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metadata.previews.map((p, i) => (
              <div key={i} className="border rounded overflow-hidden">
                {p.thumbUrl ? <img src={p.thumbUrl} alt={`preview-${i}`} className="w-full h-32 object-cover" />
                  : p.thumbData ? <img src={p.thumbData} alt={`preview-${i}`} className="w-full h-32 object-cover" />
                    : p.url ? <img src={p.url} alt={`preview-${i}`} className="w-full h-32 object-cover" />
                      : <div className="p-2 text-xs text-muted-foreground">No preview available</div>}
                <div className="p-2 text-xs break-words"><div className="font-mono">{p.path}</div></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DatasetManager;