// src/pages/PredictionPage.tsx
import { useEffect, useState, useRef, useCallback } from "react"; 
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/pages/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Play, Loader2, CheckCircle2, XCircle, Clock, Trash2, Image as ImageIcon, Video, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim();
const apiUrl = (path: string) => {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return base ? `${base}/${p}` : `/${p}`;
};

interface Dataset {
  datasetId: string; // MongoDB _id from backend
  _id?: string; // Fallback for compatibility
  id?: string; // Fallback for compatibility
  version?: string;
  testCount?: number;
  totalImages?: number;
  createdAt?: string;
  status?: string;
  company?: string;
  project?: string;
}

interface Model {
  modelId: string; // MongoDB _id from backend
  _id?: string; // Fallback for compatibility
  modelVersion?: string;
  modelType?: string;
  name?: string;
  metrics?: {
    mAP50?: number;
    precision?: number;
    recall?: number;
  };
  createdAt?: string;
}

interface InferenceStatus {
  inferenceId?: string;
  status: "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";
  progress?: {
    totalImages?: number;
    processedImages?: number;
    progressPercent?: number;
  } | number; // Support both nested (backend) and flat (legacy)
  processedImages?: number; // Legacy flat structure
  totalImages?: number; // Legacy flat structure
  message?: string;
  startedAt?: string;
  completedAt?: string | null;
  error?: string | null;
}

interface InferenceResults {
  // Backend returns nested structure: { results: { ... } }
  // This interface represents the inner results object
  totalDetections: number;
  averageConfidence: number;
  detectionsByClass: Array<{
    className: string;
    count: number;
    avgConfidence?: number; // Backend uses "avgConfidence"
    averageConfidence?: number; // Fallback
  }>;
  annotatedImages: Array<{
    filename: string;
    url: string;
    detections?: Array<{
      className: string;
      confidence: number;
      bbox?: number[];
    }>;
  }>;
}

interface InferenceJob {
  inferenceId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  sourceType?: string;
  progress?: {
    totalImages?: number;
    processedImages?: number;
    progressPercent?: number;
  };
  model?: {
    modelId: string;
    modelVersion?: string;
    modelType?: string;
    metrics?: {
      mAP50?: number;
      precision?: number;
      recall?: number;
    };
  };
  dataset?: {
    datasetId: string;
    version?: string;
    testCount?: number;
  };
  results?: {
    totalDetections?: number;
    averageConfidence?: number;
    detectionsByClass?: Array<{
      className: string;
      count: number;
      avgConfidence?: number;
    }>;
    hasAnnotatedImages?: boolean;
  };
  startedAt?: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_PREFIX = "prediction_";
type InferenceMode = "dataset" | "custom";

const PredictionPage = () => {
  const { profile, company, sessionReady } = useProfile();
  const { toast } = useToast();

  // State
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.25);
  const [inferenceId, setInferenceId] = useState<string | null>(null);
  const [inferenceStatus, setInferenceStatus] = useState<"idle" | "queued" | "running" | "completed" | "failed" | "cancelled">("idle");
  const [inferenceProgress, setInferenceProgress] = useState<number>(0);
  const [processedImages, setProcessedImages] = useState<number>(0);
  const [totalImages, setTotalImages] = useState<number>(0);
  const [results, setResults] = useState<InferenceResults | null>(null);

  // Loading states
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [startingInference, setStartingInference] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [cancellingInference, setCancellingInference] = useState(false);
  const [deletingInference, setDeletingInference] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // History view state
  const [viewMode, setViewMode] = useState<"new" | "history">("new");
  const [pastInferences, setPastInferences] = useState<InferenceJob[]>([]);
  const [loadingPastInferences, setLoadingPastInferences] = useState(false);
  const [selectedPastInferenceId, setSelectedPastInferenceId] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");

  // Inference mode: dataset-based vs custom upload
  const [inferenceMode, setInferenceMode] = useState<InferenceMode>("dataset");

  // Local UI state for test inputs (drag-and-drop, select image/video)
  const [testFiles, setTestFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const pollIntervalRef = useRef<number | null>(null);
  const projectIdRef = useRef<string | null>(null);

  const navigate = useNavigate();

  // Auth header helper
  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  // Get company name
  const companyName = company?.name || profile?.companies?.name || "";
  
  // Get project name from selected project
  const selectedProject = projects.find(
    (p) => String(p.id) === String(selectedProjectId) || String(p.name) === String(selectedProjectId)
  );
  const projectName = selectedProject?.name || "";

  // Persistence helpers
  const saveToStorage = (key: string, value: any) => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // ignore storage errors
    }
  };

  const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const clearStorage = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // ignore
    }
  };

  // Restore inference mode on mount
  useEffect(() => {
    const savedMode = loadFromStorage<InferenceMode>("inferenceMode", "dataset");
    setInferenceMode(savedMode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load projects when company_id is available
  useEffect(() => {
    if (!sessionReady || !profile?.company_id) {
      setProjects([]);
      return;
    }

    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const { data: projectsData, error } = await supabase
          .from("projects")
          .select("id, name, description")
          .eq("company_id", profile.company_id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading projects:", error);
          return;
        }

        if (projectsData) {
          setProjects(projectsData);
          
          // Restore project selection if available
          const savedProjectId = loadFromStorage<string | null>("projectId", null);
          if (savedProjectId) {
            // Validate that the saved project still exists
            const projectExists = projectsData.some(
              (p) => String(p.id) === String(savedProjectId)
            );
            if (projectExists) {
              setSelectedProjectId(String(savedProjectId));
            } else {
              // Clear invalid project from storage
              saveToStorage("projectId", null);
            }
          }
        }
      } catch (err) {
        console.error("Error loading projects:", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, [sessionReady, profile?.company_id]);

  // Restore state on mount (after projects are loaded)
  useEffect(() => {
    if (!sessionReady || !selectedProjectId) {
      // Clear selections if no project selected
      setSelectedDatasetId(null);
      setSelectedModelId(null);
      return;
    }

    const savedDatasetId = loadFromStorage<string | null>("datasetId", null);
    const savedModelId = loadFromStorage<string | null>("modelId", null);
    const savedConfidence = loadFromStorage<number>("confidenceThreshold", 0.25);

    // Only restore dataset/model if they belong to the current project
    // (We'll validate this when fetching - if they don't exist, they'll be cleared)
    if (savedDatasetId) setSelectedDatasetId(savedDatasetId);
    if (savedModelId) setSelectedModelId(savedModelId);
    setConfidenceThreshold(savedConfidence);
  }, [sessionReady, selectedProjectId]);

  // Restore inference state separately (after functions are defined)
  useEffect(() => {
    if (!sessionReady || !selectedProjectId) return;
    
    const savedInferenceId = loadFromStorage<string | null>("inferenceId", null);
    if (savedInferenceId) {
      setInferenceId(savedInferenceId);
      // Check status immediately - functions are now defined
      void checkInferenceStatus(savedInferenceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, selectedProjectId]);

  // Fetch datasets
  const fetchDatasets = useCallback(async () => {
    if (!companyName || !projectName || !sessionReady || !selectedProjectId) {
      setDatasets([]);
      return;
    }

    setLoadingDatasets(true);
    try {
      const headers = await getAuthHeaders();
      const qs = new URLSearchParams({
        company: companyName,
        project: projectName,
      });
      const url = apiUrl(`/inference/datasets?${qs.toString()}`);
      const res = await fetch(url, { headers });

      if (!res.ok) {
        if (res.status !== 404) {
          console.error("Failed to fetch datasets:", res.status);
        }
        setDatasets([]);
        // Clear selected dataset if fetch fails
        setSelectedDatasetId(null);
        saveToStorage("datasetId", null);
        return;
      }

      const json = await res.json();
      const datasetsList = Array.isArray(json) ? json : json.datasets || [];
      setDatasets(datasetsList);
      
      // Validate that selected dataset still exists in the list
      setSelectedDatasetId((currentId) => {
        if (currentId) {
          const datasetExists = datasetsList.some(
            (d) => d.datasetId === currentId || d._id === currentId || d.id === currentId
          );
          if (!datasetExists) {
            saveToStorage("datasetId", null);
            return null;
          }
        }
        return currentId;
      });
    } catch (err) {
      console.error("Error fetching datasets:", err);
      setDatasets([]);
      setSelectedDatasetId(null);
      saveToStorage("datasetId", null);
    } finally {
      setLoadingDatasets(false);
    }
  }, [companyName, projectName, sessionReady, selectedProjectId]);

  // Fetch models
  const fetchModels = useCallback(async () => {
    if (!companyName || !projectName || !sessionReady || !selectedProjectId) {
      setModels([]);
      return;
    }

    setLoadingModels(true);
    try {
      const headers = await getAuthHeaders();
      const qs = new URLSearchParams({
        company: companyName,
        project: projectName,
      });
      const url = apiUrl(`/inference/models?${qs.toString()}`);
      const res = await fetch(url, { headers });

      if (!res.ok) {
        if (res.status !== 404) {
          console.error("Failed to fetch models:", res.status);
        }
        setModels([]);
        // Clear selected model if fetch fails
        setSelectedModelId(null);
        saveToStorage("modelId", null);
        return;
      }

      const json = await res.json();
      const modelsList = Array.isArray(json) ? json : json.models || [];
      setModels(modelsList);
      
      // Validate that selected model still exists in the list
      setSelectedModelId((currentId) => {
        if (currentId) {
          const modelExists = modelsList.some(
            (m) => m.modelId === currentId || m._id === currentId
          );
          if (!modelExists) {
            saveToStorage("modelId", null);
            return null;
          }
        }
        return currentId;
      });
    } catch (err) {
      console.error("Error fetching models:", err);
      setModels([]);
      setSelectedModelId(null);
      saveToStorage("modelId", null);
    } finally {
      setLoadingModels(false);
    }
  }, [companyName, projectName, sessionReady, selectedProjectId]);

  // Load datasets and models when project is selected
  useEffect(() => {
    if (sessionReady && companyName && projectName && selectedProjectId) {
      void fetchDatasets();
      void fetchModels();
    } else {
      // Clear datasets and models if no project selected
      setDatasets([]);
      setModels([]);
    }
  }, [sessionReady, companyName, projectName, selectedProjectId, fetchDatasets, fetchModels]);

  // Handle project selection
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    // Clear dependent selections when project changes
    setSelectedDatasetId(null);
    setSelectedModelId(null);
    saveToStorage("projectId", projectId);
    saveToStorage("datasetId", null);
    saveToStorage("modelId", null);
  };

  // Handle dataset selection
  const handleDatasetSelect = (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    saveToStorage("datasetId", datasetId);
  };

  // Handle inference mode change
  const handleInferenceModeChange = (mode: InferenceMode) => {
    setInferenceMode(mode);
    saveToStorage("inferenceMode", mode);
  };

  // Handle test file additions (UI only – no API changes)
  const handleAddTestFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setTestFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const next: File[] = [...prev];
      Array.from(files).forEach((file) => {
        // Avoid duplicate file entries by name
        if (!existingNames.has(file.name)) {
          next.push(file);
          existingNames.add(file.name);
        }
      });
      return next;
    });
  };

  // Handle model selection
  const handleModelSelect = (modelId: string) => {
    setSelectedModelId(modelId);
    saveToStorage("modelId", modelId);
  };

  // Handle confidence threshold change
  const handleConfidenceChange = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setConfidenceThreshold(clamped);
    saveToStorage("confidenceThreshold", clamped);
  };

  // Check inference status
  const checkInferenceStatus = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const url = apiUrl(`/inference/${encodeURIComponent(id)}/status`);
      const res = await fetch(url, { headers });

      if (!res.ok) {
        if (res.status === 404) {
          // Inference not found, clear it
          setInferenceId(null);
          setInferenceStatus("idle");
          clearStorage();
          return;
        }
        throw new Error(`Status check failed: ${res.status}`);
      }

      const data: InferenceStatus = await res.json();
      setInferenceStatus(data.status);
      
      // Handle nested progress structure from backend
      if (data.progress !== undefined) {
        if (typeof data.progress === "object" && data.progress !== null) {
          // Backend nested structure: { progress: { totalImages, processedImages, progressPercent } }
          const progressObj = data.progress as { totalImages?: number; processedImages?: number; progressPercent?: number };
          if (progressObj.progressPercent !== undefined) {
            setInferenceProgress(progressObj.progressPercent);
          }
          if (progressObj.processedImages !== undefined) {
            setProcessedImages(progressObj.processedImages);
          }
          if (progressObj.totalImages !== undefined) {
            setTotalImages(progressObj.totalImages);
          }
        } else if (typeof data.progress === "number") {
          // Legacy flat structure
          setInferenceProgress(data.progress);
        }
      }
      
      // Fallback to top-level fields (legacy support)
      if (data.processedImages !== undefined) {
        setProcessedImages(data.processedImages);
      }
      if (data.totalImages !== undefined) {
        setTotalImages(data.totalImages);
      }

      // Save state
      const progressValue = typeof data.progress === "object" && data.progress !== null
        ? (data.progress as { progressPercent?: number }).progressPercent ?? 0
        : (typeof data.progress === "number" ? data.progress : 0);
      const processedValue = data.processedImages ?? (typeof data.progress === "object" && data.progress !== null ? (data.progress as { processedImages?: number }).processedImages ?? 0 : 0);
      const totalValue = data.totalImages ?? (typeof data.progress === "object" && data.progress !== null ? (data.progress as { totalImages?: number }).totalImages ?? 0 : 0);
      saveToStorage("status", data.status);
      saveToStorage("progress", progressValue);
      saveToStorage("processedImages", processedValue);
      saveToStorage("totalImages", totalValue);

      // Stop polling if completed/failed/cancelled
      if (["completed", "failed", "cancelled"].includes(data.status)) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        if (data.status === "completed") {
          // Fetch results
          void fetchResults(id);
        } else if (data.status === "failed" || data.status === "cancelled") {
          // Clear inference ID on failure
          setInferenceId(null);
          clearStorage();
        }
      }
    } catch (err: any) {
      console.error("Error checking inference status:", err);
      if (err?.message?.includes("404")) {
        setInferenceId(null);
        setInferenceStatus("idle");
        clearStorage();
      }
    }
  };

  // Start polling
  const startPolling = (id: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Check immediately
    void checkInferenceStatus(id);

    // Then poll every 2-3 seconds
    const interval = setInterval(() => {
      void checkInferenceStatus(id);
    }, 2500);
    pollIntervalRef.current = interval as unknown as number;
  };

  // Cancel inference
  const cancelInference = async () => {
    if (!inferenceId) return;

    setCancellingInference(true);
    try {
      const headers = await getAuthHeaders();
      const url = apiUrl(`/inference/${encodeURIComponent(inferenceId)}/cancel`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to cancel inference: ${res.status}`;

        // Handle specific error cases
        if (res.status === 400) {
          toast({
            title: "Cannot cancel",
            description: errorMessage,
            variant: "destructive",
          });
        } else if (res.status === 404) {
          toast({
            title: "Inference not found",
            description: "The inference job was not found.",
            variant: "destructive",
          });
          // Clear invalid inference ID
          setInferenceId(null);
          setInferenceStatus("idle");
          clearStorage();
        } else {
          throw new Error(errorMessage);
        }
        return;
      }

      const data = await res.json();

      // Stop polling immediately
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Update status to cancelled
      setInferenceStatus("cancelled");

      // Clear persisted state
      setInferenceId(null);
      clearStorage();

      toast({
        title: "Inference cancelled",
        description: data.message || "Inference job cancelled successfully.",
      });
    } catch (err: any) {
      console.error("Error cancelling inference:", err);
      toast({
        title: "Cancel failed",
        description: err?.message || "Could not cancel inference.",
        variant: "destructive",
      });
    } finally {
      setCancellingInference(false);
    }
  };

  // Delete inference
  const deleteInference = async () => {
    if (!inferenceId) return;

    setDeletingInference(true);
    try {
      const headers = await getAuthHeaders();
      const url = apiUrl(`/inference/${encodeURIComponent(inferenceId)}`);
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to delete inference: ${res.status}`;

        // Handle specific error cases
        if (res.status === 400) {
          toast({
            title: "Cannot delete",
            description: errorData.message || "Cannot delete a running or queued job. Please cancel it first.",
            variant: "destructive",
          });
        } else if (res.status === 404) {
          toast({
            title: "Inference not found",
            description: "The inference job was not found. It may have already been deleted.",
            variant: "destructive",
          });
          // Clear invalid inference ID
          setInferenceId(null);
          setInferenceStatus("idle");
          clearStorage();
        } else {
          throw new Error(errorMessage);
        }
        return;
      }

      const data = await res.json();

      // Clear all inference-related state
      setInferenceId(null);
      setInferenceStatus("idle");
      setInferenceProgress(0);
      setProcessedImages(0);
      setTotalImages(0);
      setResults(null);
      clearStorage();

      toast({
        title: "Inference deleted",
        description: data.message || "Inference job and results deleted successfully.",
      });

      // Refresh history list if in history view
      if (viewMode === "history") {
        void fetchPastInferences();
      }

      // Scroll to top to show configuration section
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Error deleting inference:", err);
      toast({
        title: "Delete failed",
        description: err?.message || "Could not delete inference.",
        variant: "destructive",
      });
    } finally {
      setDeletingInference(false);
      setShowDeleteDialog(false);
    }
  };

  // Fetch past inference jobs
  const fetchPastInferences = useCallback(async () => {
    if (!companyName || !projectName || !sessionReady || !selectedProjectId) {
      setPastInferences([]);
      return;
    }

    setLoadingPastInferences(true);
    try {
      const headers = await getAuthHeaders();
      const qs = new URLSearchParams({
        company: companyName,
        project: projectName,
      });
      if (historyStatusFilter && historyStatusFilter !== "all") {
        qs.append("status", historyStatusFilter);
      }
      const url = apiUrl(`/inference?${qs.toString()}`);
      const res = await fetch(url, { headers });

      if (!res.ok) {
        if (res.status !== 404) {
          console.error("Failed to fetch past inferences:", res.status);
        }
        setPastInferences([]);
        return;
      }

      const json = await res.json();
      const jobsList = Array.isArray(json.inferenceJobs) ? json.inferenceJobs : (json.inferenceJobs || []);
      setPastInferences(jobsList);
    } catch (err) {
      console.error("Error fetching past inferences:", err);
      setPastInferences([]);
    } finally {
      setLoadingPastInferences(false);
    }
  }, [companyName, projectName, sessionReady, selectedProjectId, historyStatusFilter]);

  // Fetch past inferences when in history view and project is selected
  useEffect(() => {
    if (viewMode === "history" && sessionReady && companyName && projectName && selectedProjectId) {
      void fetchPastInferences();
    }
  }, [viewMode, sessionReady, companyName, projectName, selectedProjectId, historyStatusFilter, fetchPastInferences]);

  // View results for a past inference (navigate to dedicated details page)
  const loadPastInferenceResults = (inferenceId: string) => {
    setSelectedPastInferenceId(inferenceId);
    navigate(`/project/prediction/history/${encodeURIComponent(inferenceId)}`);
  };

  // Fetch results
  const fetchResults = async (id: string) => {
    setLoadingResults(true);
    try {
      const headers = await getAuthHeaders();
      const url = apiUrl(`/inference/${encodeURIComponent(id)}/results`);
      const res = await fetch(url, { headers });

      if (!res.ok) {
        if (res.status === 400 || res.status === 404) {
          toast({
            title: "Results not available",
            description: "Results are not ready yet or not found.",
            variant: "destructive",
          });
        }
        return;
      }

      const response = await res.json();
      // Backend returns nested structure: { results: { ... } }
      // Extract the inner results object
      const data: InferenceResults = response.results || response;

      // Normalize detectionsByClass to use consistent field names
      // and ensure annotatedImages always have a usable URL
      const normalizedData: InferenceResults = {
        ...data,
        detectionsByClass:
          data.detectionsByClass?.map((item) => ({
            ...item,
            averageConfidence: item.avgConfidence ?? item.averageConfidence ?? 0,
          })) || [],
        annotatedImages:
          data.annotatedImages?.map((img) => {
            // If backend provided a URL starting with "/api/", strip the leading "/api"
            // before passing to apiUrl, because API_BASE_URL already includes "/api".
            const rawPath =
              img.url && img.url.startsWith("/api/")
                ? img.url.slice(4) // remove leading "/api"
                : img.url ||
                  `/inference/${encodeURIComponent(id)}/image/${encodeURIComponent(
                    img.filename,
                  )}`;

            return {
              ...img,
              url: apiUrl(rawPath),
            };
          }) || [],
      };

      setResults(normalizedData);
    } catch (err: any) {
      console.error("Error fetching results:", err);
      toast({
        title: "Failed to load results",
        description: err?.message || "Could not fetch inference results.",
        variant: "destructive",
      });
    } finally {
      setLoadingResults(false);
    }
  };

  // Start inference
  const handleStartInference = async () => {
    // Model is always required
    if (!selectedModelId) {
      toast({
        title: "Model required",
        description: "Please select a model before starting inference.",
        variant: "destructive",
      });
      return;
    }

    if (inferenceMode === "dataset") {
      if (!selectedDatasetId) {
        toast({
          title: "Dataset required",
          description: "Please select a dataset when using dataset mode.",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Custom images mode
      if (testFiles.length === 0) {
        toast({
          title: "Test images required",
          description: "Add at least one image or video when using custom upload mode.",
          variant: "destructive",
        });
        return;
      }
    }

    setStartingInference(true);
    try {
      const headers = await getAuthHeaders();
      const url = apiUrl("/inference/start");

      let res: Response;

      if (inferenceMode === "dataset") {
        // Existing JSON-based dataset inference
        res = await fetch(url, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            modelId: selectedModelId,
            datasetId: selectedDatasetId,
            confidenceThreshold: confidenceThreshold,
          }),
        });
      } else {
        // New custom upload inference using multipart/form-data
        const formData = new FormData();
        formData.append("modelId", selectedModelId);
        formData.append("confidenceThreshold", confidenceThreshold.toString());
        testFiles.forEach((file) => {
          formData.append("images", file);
        });

        res = await fetch(url, {
          method: "POST",
          headers: {
            ...headers,
            // Do not set Content-Type here; the browser will set it with the correct boundary
          },
          body: formData,
        });
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        let errorMessage = `Failed to start inference: ${res.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          if (errorText) errorMessage = errorText;
        }

        if (res.status === 400 || res.status === 404) {
          toast({
            title: "Invalid request",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          throw new Error(errorMessage);
        }
        return;
      }

      const json = await res.json();
      const newInferenceId = json.inferenceId || json.id || json._id;
      if (!newInferenceId) {
        throw new Error("No inference ID returned from server");
      }

      setInferenceId(newInferenceId);
      setInferenceStatus("queued");
      setInferenceProgress(0);
      setResults(null);
      saveToStorage("inferenceId", newInferenceId);
      saveToStorage("status", "queued");

      toast({
        title: "Inference started",
        description: "Prediction job has been queued.",
      });

      // Start polling
      startPolling(newInferenceId);
    } catch (err: any) {
      console.error("Error starting inference:", err);
      toast({
        title: "Failed to start inference",
        description: err?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setStartingInference(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Get status badge for inference job
  const getStatusBadgeForJob = (status: string) => {
    switch (status) {
      case "queued":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="mr-1 h-3 w-3" />
            Queued
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <XCircle className="mr-1 h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    switch (inferenceStatus) {
      case "queued":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="mr-1 h-3 w-3" />
            Queued
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <XCircle className="mr-1 h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  const selectedDataset = datasets.find((d) => d.datasetId === selectedDatasetId || d._id === selectedDatasetId || d.id === selectedDatasetId);
  const selectedModel = models.find((m) => m.modelId === selectedModelId || m._id === selectedModelId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Prediction (Testing)"
        description="Test and evaluate your trained models with new data"
      />

      {/* Tabs for New Inference and History */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "new" | "history")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="new">New Inference</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Project Selection */}
        {(inferenceStatus === "idle" || viewMode === "history") && (
          <Card>
            <CardHeader>
              <CardTitle>Select Project</CardTitle>
              <CardDescription>Choose project scope for datasets and models</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedProjectId} onValueChange={handleProjectSelect} disabled={loadingProjects}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {loadingProjects ? (
                    <SelectItem value="loading" disabled>
                      Loading projects...
                    </SelectItem>
                  ) : projects.length === 0 ? (
                    <SelectItem value="no-projects" disabled>
                      No projects available
                    </SelectItem>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={String(project.id)} value={String(project.id)}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!selectedProjectId && (
                <p className="text-sm text-muted-foreground mt-2">
                  Select a project to continue
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* New Inference Tab */}
        <TabsContent value="new" className="space-y-6">
          {/* Inference mode toggle */}
          {inferenceStatus === "idle" && selectedProjectId && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Inference mode</h3>
                <p className="text-xs text-muted-foreground">
                  Choose whether to use a dataset&apos;s test folder or upload custom images.
                </p>
              </div>
              <div className="inline-flex rounded-md border bg-muted/50 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={inferenceMode === "dataset" ? "default" : "ghost"}
                  className="rounded-sm"
                  onClick={() => handleInferenceModeChange("dataset")}
                >
                  Use dataset
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={inferenceMode === "custom" ? "default" : "ghost"}
                  className="rounded-sm"
                  onClick={() => handleInferenceModeChange("custom")}
                >
                  Upload custom images
                </Button>
              </div>
            </div>
          )}

          {/* Configuration Section */}
          {inferenceStatus === "idle" && selectedProjectId && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Test Inputs (replaces Dataset Selection visually, keeps logic unchanged) */}
          <Card>
            <CardHeader>
              <CardTitle>Test Inputs</CardTitle>
              <CardDescription>Add test images, videos, or use your camera for inference</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag & Drop Area */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg px-4 py-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer",
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20 hover:bg-muted/30"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleAddTestFiles(e.dataTransfer.files);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const input = document.getElementById("prediction-test-files-input");
                    if (input) {
                      (input as HTMLInputElement).click();
                    }
                  }
                }}
              >
                <BrainCircuit className="h-8 w-8 text-primary mb-3" />
                <p className="text-sm font-medium">
                  Drag &amp; drop test images or videos here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: common image (PNG, JPG) and video (MP4, MOV) files
                </p>
              </div>

              {/* Hidden file inputs for Select image / Select video */}
              <input
                id="prediction-test-files-input"
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddTestFiles(e.target.files);
                  // Do not clear the value so the same file can be re-selected if needed
                }}
              />
              <input
                id="prediction-test-image-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddTestFiles(e.target.files);
                  // Do not clear the value so the same file can be re-selected if needed
                }}
              />
              <input
                id="prediction-test-video-input"
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddTestFiles(e.target.files);
                  // Do not clear the value so the same file can be re-selected if needed
                }}
              />

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => {
                    const input = document.getElementById("prediction-test-image-input");
                    if (input) {
                      (input as HTMLInputElement).click();
                    }
                  }}
                >
                  <ImageIcon className="h-4 w-4" />
                  Select image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => {
                    const input = document.getElementById("prediction-test-video-input");
                    if (input) {
                      (input as HTMLInputElement).click();
                    }
                  }}
                >
                  <Video className="h-4 w-4" />
                  Select video
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex items-center gap-2"
                  // UI only: placeholder for future live camera support
                  onClick={() => {
                    toast({
                      title: "Live camera",
                      description: "Live camera input will be supported in a future update.",
                    });
                  }}
                >
                  <Camera className="h-4 w-4" />
                  Live camera
                </Button>
              </div>

              {/* Selected files summary (UI only) */}
              {testFiles.length > 0 && (
                <div className="mt-2 rounded-md bg-muted/40 border border-dashed border-muted-foreground/30 px-3 py-2 text-xs">
                  <div className="font-medium mb-1">
                    {testFiles.length} file{testFiles.length !== 1 ? "s" : ""} selected
                  </div>
                  <div className="space-y-0.5 max-h-20 overflow-auto">
                    {testFiles.slice(0, 3).map((file) => (
                      <div key={file.name} className="truncate text-muted-foreground">
                        {file.name}
                      </div>
                    ))}
                    {testFiles.length > 3 && (
                      <div className="text-muted-foreground">
                        + {testFiles.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Model</CardTitle>
              <CardDescription>Choose a trained model for inference</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingModels ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : models.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No trained models available.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-auto">
                  {models.map((model, idx) => {
                    const modelId = model.modelId || model._id || "";
                    const isSelected = modelId === selectedModelId;
                    const modelKey = modelId || `model-${idx}`;
                    return (
                      <button
                        key={modelKey}
                        onClick={() => handleModelSelect(modelId)}
                        className={cn(
                          "w-full text-left p-3 rounded-md border transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <div className="font-medium">
                          {model.name || model.modelVersion || model.modelId || "Unnamed Model"}
                        </div>
                        {model.metrics && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {model.metrics.mAP50 !== undefined && (
                              <div>mAP50: {model.metrics.mAP50.toFixed(3)}</div>
                            )}
                            {model.metrics.precision !== undefined && (
                              <div>Precision: {model.metrics.precision.toFixed(3)}</div>
                            )}
                            {model.metrics.recall !== undefined && (
                              <div>Recall: {model.metrics.recall.toFixed(3)}</div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confidence Threshold & Start Button */}
      {inferenceStatus === "idle" && selectedProjectId && (
        <Card>
          <CardHeader>
            <CardTitle>Inference Settings</CardTitle>
            <CardDescription>Configure confidence threshold and start prediction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence Threshold</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="confidence"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={confidenceThreshold}
                  onChange={(e) => handleConfidenceChange(parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={confidenceThreshold}
                  onChange={(e) => handleConfidenceChange(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {confidenceThreshold.toFixed(2)}
                </span>
              </div>
            </div>

            {(() => {
              const canStart =
                inferenceMode === "dataset"
                  ? !!selectedProjectId && !!selectedDatasetId && !!selectedModelId
                  : !!selectedProjectId && !!selectedModelId && testFiles.length > 0;
              return (
                <Button
                  onClick={handleStartInference}
                  disabled={!canStart || startingInference}
                  className="w-full"
                >
              {startingInference ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Prediction
                </>
              )}
                </Button>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Progress Section - only in New Inference view */}
      {viewMode === "new" && inferenceStatus !== "idle" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Inference Progress</CardTitle>
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                {/* Cancel Button - Show only when queued or running */}
                {(inferenceStatus === "queued" || inferenceStatus === "running") && (
                  <Button
                    onClick={cancelInference}
                    variant="outline"
                    size="sm"
                    disabled={cancellingInference}
                    className="text-destructive hover:text-destructive"
                  >
                    {cancellingInference ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              {selectedDataset && `Dataset: ${selectedDataset.version || "Unversioned"}`}
              {selectedModel && ` • Model: ${selectedModel.modelVersion || selectedModel.modelId}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Progress
                value={
                  inferenceProgress > 0
                    ? Math.min(Math.max(inferenceProgress, 0), 100)
                    : inferenceStatus === "queued" || inferenceStatus === "running"
                    ? 100
                    : 0
                }
                className="h-2"
                indicatorClassName={cn(
                  (inferenceStatus === "queued" || inferenceStatus === "running") &&
                    inferenceProgress === 0 &&
                    "progress-striped progress-animated",
                  inferenceStatus === "completed" && "bg-[hsl(var(--success))]",
                  inferenceStatus === "failed" && "bg-[hsl(var(--destructive))]"
                )}
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {inferenceProgress > 0
                    ? `${inferenceProgress}%`
                    : inferenceStatus === "queued"
                    ? "Queued"
                    : inferenceStatus === "running"
                    ? "Initializing..."
                    : "0%"}
                </span>
              </div>
              {totalImages > 0 && (
                <div className="text-sm text-muted-foreground">
                  Processed: {processedImages} / {totalImages} images
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

          {/* Results Section */}
          {inferenceStatus === "completed" && (
        <>
          {loadingResults ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : results ? (
            <>
              {/* Action Buttons - Above Results Summary */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  onClick={() => {
                    setInferenceId(null);
                    setInferenceStatus("idle");
                    setInferenceProgress(0);
                    setProcessedImages(0);
                    setTotalImages(0);
                    setResults(null);
                    clearStorage();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  variant="outline"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start New Inference
                </Button>
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Results
                </Button>
              </div>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Results Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-2xl font-bold">{results.totalDetections}</div>
                      <div className="text-sm text-muted-foreground">Total Detections</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {(results.averageConfidence * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Average Confidence</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {results.detectionsByClass.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Classes Detected</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detections by Class */}
              {results.detectionsByClass.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Detections by Class</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Class</th>
                            <th className="text-right p-2">Count</th>
                            <th className="text-right p-2">Avg Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.detectionsByClass.map((item, idx) => (
                            <tr key={item.className || `class-${idx}`} className="border-b">
                              <td className="p-2 font-medium">{item.className}</td>
                              <td className="p-2 text-right">{item.count}</td>
                              <td className="p-2 text-right">
                                {(item.averageConfidence * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Annotated Images */}
              {results.annotatedImages && results.annotatedImages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Annotated Images</CardTitle>
                    <CardDescription>
                      {results.annotatedImages.length} image
                      {results.annotatedImages.length !== 1 ? "s" : ""} with detections
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {results.annotatedImages.map((img, idx) => (
                        <div key={img.filename || img.url || `image-${idx}`} className="space-y-2">
                          <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                            <img
                              src={img.url}
                              alt={img.filename}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {img.filename}
                          </div>
                          {img.detections && img.detections.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {img.detections.length} detection
                              {img.detections.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Results are not available yet.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

          {/* Error State */}
          {inferenceStatus === "failed" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Inference Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  The inference job failed. Please try again or check the logs for more details.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => {
                      setInferenceId(null);
                      setInferenceStatus("idle");
                      setInferenceProgress(0);
                      setResults(null);
                      clearStorage();
                    }}
                    variant="outline"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start New Inference
                  </Button>
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancelled State */}
          {inferenceStatus === "cancelled" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">Inference Cancelled</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  The inference job has been cancelled. You can start a new inference when ready.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => {
                      setInferenceId(null);
                      setInferenceStatus("idle");
                      setInferenceProgress(0);
                      setResults(null);
                      clearStorage();
                    }}
                    variant="outline"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start New Inference
                  </Button>
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          {!selectedProjectId ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Please select a project to view inference history.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Inference History</CardTitle>
                    <CardDescription>View past inference jobs and their results</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="status-filter" className="whitespace-nowrap text-sm">
                      Filter by Status:
                    </Label>
                    <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                      <SelectTrigger id="status-filter" className="w-40 md:w-48 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="queued">Queued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {loadingPastInferences ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pastInferences.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No inference jobs found
                    {historyStatusFilter !== "all" ? ` with status "${historyStatusFilter}"` : ""}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pastInferences.map((job) => (
                      <Card key={job.inferenceId} className="border-muted">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <CardTitle className="text-sm font-semibold truncate">
                                Inference: {job.inferenceId}
                              </CardTitle>
                              {getStatusBadgeForJob(job.status)}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(job.status === "completed" ||
                                job.status === "failed" ||
                                job.status === "cancelled") && (
                                <>
                                  {job.status === "completed" && (
                                    <Button
                                      onClick={() => loadPastInferenceResults(job.inferenceId)}
                                      variant="outline"
                                      size="sm"
                                    >
                                      <Play className="mr-2 h-4 w-4" />
                                      View Results
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() => {
                                      setInferenceId(job.inferenceId);
                                      setShowDeleteDialog(true);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-xs md:text-sm">
                            {job.model && (
                              <div>
                                <div className="text-muted-foreground">Model</div>
                                <div className="font-medium">
                                  {job.model.modelType} - {job.model.modelVersion || "v1"}
                                </div>
                              </div>
                            )}
                            {job.dataset && (
                              <div>
                                <div className="text-muted-foreground">Dataset</div>
                                <div className="font-medium">
                                  {job.dataset.version || "Unversioned"} ({job.dataset.testCount || 0} test images)
                                </div>
                              </div>
                            )}
                            {job.startedAt && (
                              <div>
                                <div className="text-muted-foreground">Started</div>
                                <div className="font-medium">
                                  {new Date(job.startedAt).toLocaleString()}
                                </div>
                              </div>
                            )}
                            {job.completedAt && (
                              <div>
                                <div className="text-muted-foreground">Completed</div>
                                <div className="font-medium">
                                  {new Date(job.completedAt).toLocaleString()}
                                </div>
                              </div>
                            )}
                            {job.progress && typeof job.progress === "object" && (
                              <div>
                                <div className="text-muted-foreground">Progress</div>
                                <div className="font-medium">
                                  {job.progress.processedImages || 0} / {job.progress.totalImages || 0} images
                                  {job.progress.progressPercent !== undefined && ` (${job.progress.progressPercent}%)`}
                                </div>
                              </div>
                            )}
                            {job.results && (
                              <>
                                <div>
                                  <div className="text-muted-foreground">Total Detections</div>
                                  <div className="font-medium">{job.results.totalDetections || 0}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Avg Confidence</div>
                                  <div className="font-medium">
                                    {job.results.averageConfidence
                                      ? `${(job.results.averageConfidence * 100).toFixed(1)}%`
                                      : "N/A"}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          {job.results?.detectionsByClass && job.results.detectionsByClass.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="text-xs md:text-sm text-muted-foreground mb-2">Detections by Class</div>
                              <div className="flex flex-wrap gap-2">
                                {job.results.detectionsByClass.map((item, idx) => (
                                  <Badge key={idx} variant="outline">
                                    {item.className}: {item.count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inference Results?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inference result?
              <br /><br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All annotated images</li>
                <li>Metadata and results</li>
                <li>The inference job record</li>
              </ul>
              <br />
              <strong>This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInference}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteInference}
              disabled={deletingInference}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingInference ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PredictionPage;

