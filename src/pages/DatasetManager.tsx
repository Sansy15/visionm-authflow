// src/pages/DatasetManager.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Grid3x3, List, X, Download, FileText } from "lucide-react";

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
  files?: Array<{
    id?: string;
    _id?: string;
    storedName?: string;
    originalName?: string;
    name?: string;
    type?: string;
    size?: number;
    folder?: string;
    storedPath?: string;
    path?: string;
    thumbnailAvailable?: boolean;
    url?: string;
  }>;
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
  storedName?: string;
  originalName: string;
  type?: string;
  size?: number;
  folder?: string;
  storedPath: string;
  thumbnailAvailable?: boolean;
  url?: string;
  // Legacy fields for backward compatibility
  name?: string;
  path?: string;
  thumbUrl?: string;
  mime?: string;
}

const MAX_FILES = 5000;
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB - adjust if needed

const DatasetManager = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { sessionReady, user } = useProfile();
  const [project, setProject] = useState<any>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [version, setVersion] = useState<string>("");

  const [files, setFiles] = useState<File[]>([]);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const [selectedFolderType, setSelectedFolderType] = useState<"labelled" | "unlabelled" | null>(null);
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
  
  // Drive-style preview state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<FileEntry[]>([]);
  const [folderFilesLoading, setFolderFilesLoading] = useState(false);
  const [folderFilesPage, setFolderFilesPage] = useState(1);
  const [folderFilesTotal, setFolderFilesTotal] = useState(0);
  const [folderFilesTotalPages, setFolderFilesTotalPages] = useState(0);
  const [fileTypeFilter, setFileTypeFilter] = useState<"all" | "image" | "label">("all");
  const [fileSort, setFileSort] = useState<"name" | "size">("name");
  const [fileSortOrder, setFileSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");
  const [selectedImageFile, setSelectedImageFile] = useState<FileEntry | null>(null);
  const [selectedLabelFile, setSelectedLabelFile] = useState<FileEntry | null>(null);
  const [labelFileContent, setLabelFileContent] = useState<string | null>(null);

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
    // Early return if session not ready
    if (!sessionReady) return;

    // Redirect if no user
    if (sessionReady && !user) {
      navigate("/auth?mode=signin");
      return;
    }

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

      // DB request - Supabase client automatically includes Authorization header
      // Session is already ready and user exists (checked above)
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

    // Only run init when session is ready and user exists
    if (sessionReady && user) {
      void init();
    }
  }, [sessionReady, user, projectId, navigate, toast]);

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

  // ------- Deselect folder -------
  const handleDeselectFolder = () => {
    setFiles([]);
    setSelectedFolderName(null);
    setSelectedFolderType(null);
    setStatusMessage("Idle");
    setUploadStatus("idle");
    setLabelledFolderError(null);
    setUnlabelledFolderError(null);
    // Clear file inputs
    const labelledInput = document.getElementById("labelled-folder-input") as HTMLInputElement | null;
    const unlabelledInput = document.getElementById("unlabelled-folder-input") as HTMLInputElement | null;
    if (labelledInput) labelledInput.value = "";
    if (unlabelledInput) unlabelledInput.value = "";
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

    // Run validation immediately after folder selection
    try {
      const selectedFiles = Array.from(fileList);

      // Check for .txt files FIRST (immediate validation)
      const txtFiles = selectedFiles.filter(file => 
        file.name.toLowerCase().endsWith('.txt')
      );

      if (isLabelled) {
        // Labelled folder must contain at least one .txt file
        if (txtFiles.length === 0) {
          const errorMsg = "Please include at least one .txt file in this folder.";
          setLabelledFolderError(errorMsg);
          toast({
            title: "Invalid selection",
            description: errorMsg,
            variant: "destructive",
          });
          return;
        }
      } else {
        // Unlabelled folder must contain zero .txt files
        if (txtFiles.length > 0) {
          const errorMsg = "Remove all .txt files from this folder to proceed.";
          setUnlabelledFolderError(errorMsg);
          toast({
            title: "Invalid selection",
            description: errorMsg,
            variant: "destructive",
          });
          return;
        }
      }

      // Check file count
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

      // Check file sizes
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

      // Extract folder name from first file's webkitRelativePath
      let folderName = "Selected Folder";
      if (validFiles.length > 0) {
        // @ts-ignore webkitRelativePath available in supported browsers
        const relPath = (validFiles[0] as any).webkitRelativePath || validFiles[0].name;
        const pathParts = relPath.split('/').filter(Boolean);
        if (pathParts.length > 1) {
          folderName = pathParts[0]; // First directory is the folder name
        } else {
          folderName = validFiles[0].name; // Fallback to filename if no path
        }
      }

      setFiles(validFiles);
      setSelectedFolderName(folderName);
      setSelectedFolderType(isLabelled ? "labelled" : "unlabelled");
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
  const fetchFileManifest = async (
    datasetId: string, 
    page = 1, 
    limit = 1000,
    folder?: string,
    type?: string,
    sort?: string,
    order?: string
  ) => {
    try {
      const headers = await getAuthHeaders();
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (folder) qs.append("folder", folder);
      if (type && type !== "all") qs.append("type", type);
      if (sort) qs.append("sort", sort);
      if (order) qs.append("order", order);
      const url = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/files?${qs.toString()}`);
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        throw new Error(`files fetch failed ${res.status}`);
      }
      const json = await res.json();
      // API returns: { files: [...], items: [...], totalFiles, total, totalPages, page, limit, datasetId }
      // Handle both 'files' and 'items' response formats
      const rawFiles = json.files || json.items || [];
      // Map API response fields to FileEntry interface
      const list: FileEntry[] = rawFiles.map((file: any) => ({
        id: file.id || file.fileId,
        storedName: file.storedName,
        originalName: file.originalName || file.name || "",
        type: file.type,
        size: file.size,
        folder: file.folder,
        storedPath: file.storedPath || file.path || (file.folder ? `${file.folder}/${file.originalName || file.name}` : file.originalName || file.name || ""),
        thumbnailAvailable: file.thumbnailAvailable,
        url: file.url,
        // Legacy fields for backward compatibility
        name: file.originalName || file.name,
        path: file.storedPath || file.path,
        thumbUrl: file.thumbUrl,
        mime: file.mime,
      }));
      return { 
        list, 
        meta: {
          ...json,
          totalFiles: json.totalFiles || json.total || 0,
          totalPages: json.totalPages || Math.ceil((json.totalFiles || json.total || 0) / limit),
        }
      };
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

  // ------- Lazy-load files for a specific folder -------
  const fetchFolderFiles = async (datasetId: string, folderName: string, page = 1, reset = false) => {
    if (reset) {
      setFolderFiles([]);
      setFolderFilesPage(1);
    }
    setFolderFilesLoading(true);
    try {
      const { list, meta } = await fetchFileManifest(
        datasetId,
        page,
        50, // Smaller limit for folder view
        folderName,
        fileTypeFilter !== "all" ? fileTypeFilter : undefined,
        fileSort,
        fileSortOrder
      );
      if (reset) {
        setFolderFiles(list);
      } else {
        setFolderFiles((prev) => [...prev, ...list]);
      }
      if (meta) {
        setFolderFilesTotal(meta.totalFiles || 0);
        setFolderFilesTotalPages(meta.totalPages || 1);
      }
      setFolderFilesPage(page);
    } catch (err) {
      console.warn("fetchFolderFiles error:", err);
      toast({
        title: "Error",
        description: "Failed to load folder files.",
        variant: "destructive",
      });
    } finally {
      setFolderFilesLoading(false);
    }
  };

  // ------- Load more files (pagination) -------
  const loadMoreFolderFiles = () => {
    const datasetId = selectedVersionDatasetId || currentDatasetId;
    if (!datasetId || !selectedFolder) return;
    if (folderFilesPage < folderFilesTotalPages) {
      fetchFolderFiles(datasetId, selectedFolder, folderFilesPage + 1, false);
    }
  };

  // ------- Handle folder selection -------
  const handleFolderSelect = (folderName: string) => {
    setSelectedFolder(folderName);
    setViewMode("grid");
    const datasetId = selectedVersionDatasetId || currentDatasetId;
    if (datasetId) {
      fetchFolderFiles(datasetId, folderName, 1, true);
    }
  };

  // ------- Handle image click -------
  const handleImageClick = async (file: FileEntry) => {
    setSelectedImageFile(file);
    // Find associated label file
    const datasetId = selectedVersionDatasetId || currentDatasetId;
    if (datasetId && file.type === "image") {
      // Try to find label file in current folder files, or search in all files
      const baseName = file.originalName.replace(/\.(jpg|jpeg|png)$/i, "");
      let labelFile = folderFiles.find(
        (f) => f.type === "label" && f.originalName === `${baseName}.txt`
      );
      
      // If not found in folder files, search in fileManifest
      if (!labelFile && fileManifest.length > 0) {
        labelFile = fileManifest.find(
          (f) => f.type === "label" && f.originalName === `${baseName}.txt` && f.folder === file.folder
        );
      }
      
      if (labelFile) {
        setSelectedLabelFile(labelFile);
        // Fetch label file content - try download endpoint first, then regular file endpoint
        try {
          const headers = await getAuthHeaders();
          let url = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(labelFile.id)}/download`);
          let res = await fetch(url, { method: "GET", headers });
          
          // If download endpoint doesn't exist, try regular file endpoint
          if (!res.ok) {
            url = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(labelFile.id)}`);
            res = await fetch(url, { method: "GET", headers });
          }
          
          if (res.ok) {
            const text = await res.text();
            setLabelFileContent(text);
          } else {
            setLabelFileContent(null);
          }
        } catch (err) {
          console.warn("Failed to fetch label file:", err);
          setLabelFileContent(null);
        }
      } else {
        setSelectedLabelFile(null);
        setLabelFileContent(null);
      }
    }
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
      // Use storedPath if available, otherwise construct from folder + originalName, fallback to legacy fields
      const pathToUse = f.storedPath || (f.folder ? `${f.folder}/${f.originalName || f.name || ""}` : f.originalName || f.name || f.path || "");
      const parts = pathToUse.split("/").filter(Boolean);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        if (isFile) {
          const filePath = f.storedPath || (f.folder ? `${f.folder}/${f.originalName || f.name || ""}` : f.originalName || f.name || f.path || "");
          node.children.push({
            type: "file",
            name: part,
            path: filePath,
            fileId: f.id,
            thumbnailAvailable: f.thumbnailAvailable,
            url: f.url,
            // Legacy field for backward compatibility
            thumbUrl: f.thumbUrl,
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

    if (!version.trim()) {
      toast({
        title: "Version required",
        description: "Please enter a version name before uploading.",
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
      formData.append("version", version.trim());

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Build fileMeta array: map each file's originalName to its folder
      const fileMeta = files.map((file) => {
        // @ts-ignore webkitRelativePath available in supported browsers
        const relPath = (file as any).webkitRelativePath || file.name;
        // Extract folder from path (full path including subfolders, or "dataset" as default)
        const pathParts = relPath.split('/').filter(Boolean);
        const folder = pathParts.length > 1 
          ? pathParts.slice(0, -1).join('/')  // All directories except filename, joined with '/'
          : 'dataset';
        
        return {
          originalName: file.name,
          folder: folder,
        };
      });

      // Append fileMeta as JSON string to FormData
      formData.append('fileMeta', JSON.stringify(fileMeta));

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

      // Clear folder selection after successful upload
      setFiles([]);
      setSelectedFolderName(null);
      setSelectedFolderType(null);
      // Clear file inputs
      const labelledInput = document.getElementById("labelled-folder-input") as HTMLInputElement | null;
      const unlabelledInput = document.getElementById("unlabelled-folder-input") as HTMLInputElement | null;
      if (labelledInput) labelledInput.value = "";
      if (unlabelledInput) unlabelledInput.value = "";

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
      setSelectedFolder(null); // Reset folder selection
      setViewMode("tree"); // Default to tree view

      // Fetch full dataset metadata first (lightweight)
      try {
        const headers = await getAuthHeaders();
        const metaUrl = apiUrl(`/dataset/${encodeURIComponent(datasetId)}`);
        const metaRes = await fetch(metaUrl, { headers });
        if (metaRes.ok) {
          const metaJson = await metaRes.json();
          setMetadata(metaJson);
          // Build tree from metadata.files if available (faster than fetching all)
          if (metaJson.files && Array.isArray(metaJson.files)) {
            const filesList: FileEntry[] = metaJson.files.map((file: any) => ({
              id: file.id || file._id,
              storedName: file.storedName,
              originalName: file.originalName || file.name || "",
              type: file.type,
              size: file.size,
              folder: file.folder,
              storedPath: file.storedPath || file.path || "",
              thumbnailAvailable: file.thumbnailAvailable,
              url: file.url,
              name: file.originalName || file.name,
              path: file.storedPath || file.path,
            }));
            setFileManifest(filesList);
            setFolderTree(buildTreeFromFiles(filesList));
            const previews = filesList.slice(0, 50).map((f) => ({
              path: f.storedPath || f.path || (f.folder ? `${f.folder}/${f.originalName || f.name || ""}` : f.originalName || f.name || ""),
              fileId: f.id,
              thumbnailAvailable: f.thumbnailAvailable,
              url: f.url,
              thumbUrl: f.thumbUrl,
            }));
            setMetadata((prev) => {
              if (!prev) return null;
              return { ...prev, previews };
            });
          }
        }
      } catch (err) {
        console.warn("Failed to fetch metadata for selected version:", err);
      }

      // Also try folder summary for folder counts
      try {
        const sum = await fetchFolderSummary(datasetId);
        if (sum) setMetadata((prev) => ({ ...(prev ?? {}), ...sum }));
      } catch (err) {
        console.warn("fetchFolderSummary failed for version select:", err);
      }

      // Fallback: if metadata.files not available, fetch all files (for tree view)
      // Use a flag to track if we got files from metadata
      const currentMetadata = metadata;
      if (!currentMetadata?.files || !Array.isArray(currentMetadata.files) || currentMetadata.files.length === 0) {
        try {
          const allFiles = await fetchAllFiles(datasetId);
          setFileManifest(allFiles || []);
          setFolderTree(buildTreeFromFiles(allFiles || []));
          const previews = (allFiles || []).slice(0, 50).map((f) => ({
            path: f.storedPath || f.path || (f.folder ? `${f.folder}/${f.originalName || f.name || ""}` : f.originalName || f.name || ""),
            fileId: f.id,
            thumbnailAvailable: f.thumbnailAvailable,
            url: f.url,
            thumbUrl: f.thumbUrl,
          }));
          setMetadata((prev) => {
            if (!prev) return null;
            return { ...prev, previews };
          });
        } catch (err) {
          console.warn("Failed to fetch files for selected version:", err);
        }
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
      const folderName = node.name || "";
      return (
        <div className="pl-3">
          <div className="flex items-center gap-2">
            <span 
              className="text-sm cursor-pointer" 
              onClick={() => toggleExpanded(path)}
            >
              {expanded ? "▾" : "▸"}
            </span>
            <span 
              className="font-medium text-sm cursor-pointer hover:text-primary"
              onClick={() => {
                if (folderName) {
                  handleFolderSelect(folderName);
                } else {
                  toggleExpanded(path);
                }
              }}
            >
              {node.name || "(root)"}
            </span>
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
      const thumbEndpoint = datasetId && node.thumbnailAvailable 
        ? apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(node.fileId)}/thumbnail`) 
        : null;
      const fileEndpoint = datasetId 
        ? apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(node.fileId)}`) 
        : "#";

      const fileEntry: FileEntry = {
        id: node.fileId,
        originalName: node.name,
        storedPath: node.path,
        folder: node.folder,
        type: node.type || "image",
        thumbnailAvailable: node.thumbnailAvailable,
        url: node.url,
      };

      return (
        <div className="pl-6 py-1 flex items-center gap-3 text-xs">
          {node.thumbUrl ? (
            <img src={node.thumbUrl} className="w-12 h-8 object-cover rounded" alt={node.name} />
          ) : node.thumbnailAvailable && thumbEndpoint ? (
            <img
              src={thumbEndpoint}
              className="w-12 h-8 object-cover rounded cursor-pointer"
              alt={node.name}
              onClick={() => node.type === "image" && handleImageClick(fileEntry)}
              onError={async (e) => {
                // Only try blob fetch if thumbnailAvailable was true
                const objUrl = await fetchThumbnailAsObjectUrl(datasetId!, node.fileId);
                if (objUrl) {
                  (e.target as HTMLImageElement).src = objUrl;
                } else {
                  // Hide image if thumbnail fetch fails
                  (e.target as HTMLImageElement).style.display = 'none';
                }
              }}
            />
          ) : null}

          <a 
            href={node.url || fileEndpoint} 
            target="_blank" 
            rel="noreferrer" 
            className="break-words"
            onClick={(e) => {
              if (node.type === "image") {
                e.preventDefault();
                handleImageClick(fileEntry);
              }
            }}
          >
            {node.name}
          </a>
        </div>
      );
    }
  }

  // ------- Render -------
  return (
    <div>
      <div className="mb-6">
        <div>
          <h2 className="text-2xl font-bold">Upload dataset for {displayProjectName}</h2>
          {companyName && <p className="text-sm text-muted-foreground">{companyName}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => { setLabelledOpen((p) => !p); setUnlabelledOpen(false); }}>
            <CardTitle className="flex justify-between items-center">
              <span>Labelled data</span>
              <span className="text-xs text-muted-foreground">{labelledOpen ? "▾" : "▸"}</span>
            </CardTitle>
            <CardDescription>Upload folder with both images and labels</CardDescription>
          </CardHeader>
          {labelledOpen && (
            <CardContent className="space-y-4">
              <div>
                {selectedFolderType === "labelled" && selectedFolderName ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium flex-1">{selectedFolderName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleDeselectFolder}
                      aria-label="Deselect folder"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
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
                  </>
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
            <CardDescription>Upload folder with images only</CardDescription>
          </CardHeader>
          {unlabelledOpen && (
            <CardContent className="space-y-4">
              <div>
                {selectedFolderType === "unlabelled" && selectedFolderName ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium flex-1">{selectedFolderName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleDeselectFolder}
                      aria-label="Deselect folder"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
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
                  </>
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
          <div className="flex items-center gap-2">
            <div className="w-48">
              <Label htmlFor="version" className="text-xs uppercase text-muted-foreground">
                Version <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="version" 
                placeholder="e.g. v1" 
                value={version} 
                onChange={(e) => setVersion(e.target.value)}
                className={version.trim() === "" ? "border-destructive" : ""}
                required
              />
            </div>
            <Button 
              onClick={handleUpload} 
              disabled={uploadStatus === "uploading" || files.length === 0 || version.trim() === ""}
            >
              {uploadStatus === "uploading" ? "Uploading..." : "Upload"}
            </Button>
          </div>
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
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                {typeof metadata.totalImages === "number" && <p><span className="font-medium">Total files: </span>{metadata.totalImages}</p>}
                {typeof metadata.sizeBytes === "number" && <p><span className="font-medium">Size: </span>{(metadata.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>}
                {typeof metadata.thumbnailsGenerated === "boolean" && <p><span className="font-medium">Thumbnails: </span>{metadata.thumbnailsGenerated ? "Generated" : "Pending"}</p>}
              </div>
              
              {metadata.folders && Object.keys(metadata.folders).length > 0 && (
                <div className="pt-3 border-t">
                  <p className="font-medium mb-2">Folder breakdown:</p>
                  <div className="space-y-1.5 pl-2">
                    {Object.entries(metadata.folders).map(([folderName, stats]) => (
                      <p key={folderName} className="text-xs">
                        <span className="font-medium">{folderName}: </span>
                        {stats.images} image{stats.images !== 1 ? 's' : ''}, {stats.labels} label{stats.labels !== 1 ? 's' : ''}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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

      {/* File Browser - Tree or Grid View */}
      {selectedVersionDatasetId && metadata && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>File Browser</CardTitle>
                <CardDescription>
                  {selectedFolder ? `Viewing folder: ${selectedFolder}` : "Browse dataset files"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "tree" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("tree")}
                >
                  <List className="h-4 w-4 mr-2" />
                  Tree
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  Grid
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "tree" ? (
              <div>
                {folderTree ? (
                  <TreeNode node={folderTree} />
                ) : (
                  <div className="text-sm text-muted-foreground">No files available</div>
                )}
              </div>
            ) : (
              <div>
                {/* Filters and Sort Controls */}
                <div className="mb-4 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Filter:</Label>
                    <Select value={fileTypeFilter} onValueChange={(value: "all" | "image" | "label") => {
                      setFileTypeFilter(value);
                      const datasetId = selectedVersionDatasetId || currentDatasetId;
                      if (datasetId && selectedFolder) {
                        fetchFolderFiles(datasetId, selectedFolder, 1, true);
                      }
                    }}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Files</SelectItem>
                        <SelectItem value="image">Images</SelectItem>
                        <SelectItem value="label">Labels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Sort:</Label>
                    <Select value={fileSort} onValueChange={(value: "name" | "size") => {
                      setFileSort(value);
                      const datasetId = selectedVersionDatasetId || currentDatasetId;
                      if (datasetId && selectedFolder) {
                        fetchFolderFiles(datasetId, selectedFolder, 1, true);
                      }
                    }}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="size">Size</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Order:</Label>
                    <Select value={fileSortOrder} onValueChange={(value: "asc" | "desc") => {
                      setFileSortOrder(value);
                      const datasetId = selectedVersionDatasetId || currentDatasetId;
                      if (datasetId && selectedFolder) {
                        fetchFolderFiles(datasetId, selectedFolder, 1, true);
                      }
                    }}>
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedFolder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFolder(null);
                        setViewMode("tree");
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Folder
                    </Button>
                  )}
                </div>

                {/* Grid View */}
                {selectedFolder ? (
                  <div>
                    {folderFilesLoading && folderFiles.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-8 text-center">Loading files...</div>
                    ) : folderFiles.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-8 text-center">No files in this folder</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {folderFiles.map((file) => {
                            const datasetId = selectedVersionDatasetId || currentDatasetId;
                            const thumbEndpoint = datasetId && file.thumbnailAvailable
                              ? apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(file.id)}/thumbnail`)
                              : null;
                            
                            return (
                              <div
                                key={file.id}
                                className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => file.type === "image" && handleImageClick(file)}
                              >
                                <div className="aspect-square bg-muted flex items-center justify-center relative">
                                  {file.type === "image" ? (
                                    thumbEndpoint ? (
                                      <img
                                        src={thumbEndpoint}
                                        alt={file.originalName}
                                        className="w-full h-full object-cover"
                                        onError={async (e) => {
                                          const objUrl = await fetchThumbnailAsObjectUrl(datasetId!, file.id);
                                          if (objUrl) {
                                            (e.target as HTMLImageElement).src = objUrl;
                                          } else {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }
                                        }}
                                      />
                                    ) : (
                                      <div className="text-xs text-muted-foreground text-center p-2">No thumbnail</div>
                                    )
                                  ) : (
                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="p-2">
                                  <div className="text-xs font-medium truncate" title={file.originalName}>
                                    {file.originalName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {folderFilesPage < folderFilesTotalPages && (
                          <div className="mt-4 text-center">
                            <Button
                              variant="outline"
                              onClick={loadMoreFolderFiles}
                              disabled={folderFilesLoading}
                            >
                              {folderFilesLoading ? "Loading..." : `Load More (${folderFilesTotal - folderFiles.length} remaining)`}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Select a folder from the tree view to browse files
                  </div>
                )}
              </div>
            )}
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

      {/* Image Viewer Modal */}
      <Dialog open={!!selectedImageFile} onOpenChange={(open) => {
        if (!open) {
          setSelectedImageFile(null);
          setSelectedLabelFile(null);
          setLabelFileContent(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedImageFile?.originalName}</DialogTitle>
            <DialogDescription>
              {selectedImageFile?.folder && `Folder: ${selectedImageFile.folder}`}
              {selectedImageFile?.size && ` • Size: ${(selectedImageFile.size / 1024).toFixed(1)} KB`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Full-size Image */}
            {selectedImageFile && (() => {
              const datasetId = selectedVersionDatasetId || currentDatasetId || "";
              // Try download endpoint first, fallback to regular file endpoint, then thumbnail
              const imageUrl = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(selectedImageFile.id)}/download`);
              const fallbackUrl = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(selectedImageFile.id)}`);
              const thumbnailUrl = selectedImageFile.thumbnailAvailable 
                ? apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(selectedImageFile.id)}/thumbnail`)
                : null;
              
              return (
                <div className="flex justify-center">
                  <img
                    src={imageUrl}
                    alt={selectedImageFile.originalName}
                    className="max-w-full max-h-[60vh] object-contain"
                    onError={(e) => {
                      // Try fallback URL
                      if ((e.target as HTMLImageElement).src !== fallbackUrl) {
                        (e.target as HTMLImageElement).src = fallbackUrl;
                      } else if (thumbnailUrl) {
                        // Last resort: use thumbnail
                        (e.target as HTMLImageElement).src = thumbnailUrl;
                      } else {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }
                    }}
                  />
                </div>
              );
            })()}
            
            {/* Label File Content */}
            {selectedLabelFile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Associated Label File: {selectedLabelFile.originalName}</CardTitle>
                </CardHeader>
                <CardContent>
                  {labelFileContent ? (
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-48">
                      {labelFileContent}
                    </pre>
                  ) : (
                    <div className="text-sm text-muted-foreground">Loading label file...</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {selectedImageFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const datasetId = selectedVersionDatasetId || currentDatasetId;
                    if (datasetId) {
                      // Try download endpoint, fallback to regular file endpoint
                      const downloadUrl = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(selectedImageFile.id)}/download`);
                      const fileUrl = apiUrl(`/dataset/${encodeURIComponent(datasetId)}/file/${encodeURIComponent(selectedImageFile.id)}`);
                      // Try download first, if it fails the browser will handle it
                      window.open(downloadUrl, '_blank');
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatasetManager;