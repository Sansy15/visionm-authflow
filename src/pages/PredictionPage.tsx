// src/pages/PredictionPage.tsx
import { useEffect, useState, useRef, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Play, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim();
const apiUrl = (path: string) => {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return base ? `${base}/${p}` : `/${p}`;
};

interface Dataset {
  _id: string;
  id?: string;
  version?: string;
  testCount?: number;
  totalImages?: number;
  createdAt?: string;
  status?: string;
}

interface Model {
  _id: string;
  modelId?: string;
  modelVersion?: string;
  modelType?: string;
  metrics?: {
    mAP50?: number;
    precision?: number;
    recall?: number;
  };
  createdAt?: string;
}

interface InferenceStatus {
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  processedImages?: number;
  totalImages?: number;
  message?: string;
}

interface InferenceResults {
  totalDetections: number;
  averageConfidence: number;
  detectionsByClass: Array<{
    className: string;
    count: number;
    averageConfidence: number;
  }>;
  annotatedImages: Array<{
    filename: string;
    url: string;
    detections: Array<{
      className: string;
      confidence: number;
      bbox?: number[];
    }>;
  }>;
}

const STORAGE_PREFIX = "prediction_";

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
  const [inferenceStatus, setInferenceStatus] = useState<InferenceStatus["status"]>("idle");
  const [inferenceProgress, setInferenceProgress] = useState<number>(0);
  const [processedImages, setProcessedImages] = useState<number>(0);
  const [totalImages, setTotalImages] = useState<number>(0);
  const [results, setResults] = useState<InferenceResults | null>(null);

  // Loading states
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [startingInference, setStartingInference] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  // Refs
  const pollIntervalRef = useRef<number | null>(null);
  const projectIdRef = useRef<string | null>(null);

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
            (d) => d._id === currentId || d.id === currentId
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
            (m) => m._id === currentId || m.modelId === currentId
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
      
      if (data.progress !== undefined) {
        setInferenceProgress(data.progress);
      }
      if (data.processedImages !== undefined) {
        setProcessedImages(data.processedImages);
      }
      if (data.totalImages !== undefined) {
        setTotalImages(data.totalImages);
      }

      // Save state
      saveToStorage("status", data.status);
      saveToStorage("progress", data.progress ?? 0);
      saveToStorage("processedImages", data.processedImages ?? 0);
      saveToStorage("totalImages", data.totalImages ?? 0);

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

      const data: InferenceResults = await res.json();
      setResults(data);
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
    if (!selectedDatasetId || !selectedModelId) {
      toast({
        title: "Selection required",
        description: "Please select both a dataset and a model.",
        variant: "destructive",
      });
      return;
    }

    setStartingInference(true);
    try {
      const headers = await getAuthHeaders();
      const url = apiUrl("/inference/start");
      const res = await fetch(url, {
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

  const selectedDataset = datasets.find((d) => d._id === selectedDatasetId || d.id === selectedDatasetId);
  const selectedModel = models.find((m) => m._id === selectedModelId || m.modelId === selectedModelId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Prediction (Testing)"
        description="Test and evaluate your trained models with new data"
      />

      {/* Project Selection */}
      {inferenceStatus === "idle" && (
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

      {/* Configuration Section */}
      {inferenceStatus === "idle" && selectedProjectId && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Dataset Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Dataset</CardTitle>
              <CardDescription>Choose a dataset with test images</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingDatasets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : datasets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No ready datasets available for this project. Datasets must have test images.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-auto">
                  {datasets.map((dataset) => {
                    const isSelected =
                      dataset._id === selectedDatasetId || dataset.id === selectedDatasetId;
                    return (
                      <button
                        key={dataset._id || dataset.id}
                        onClick={() => handleDatasetSelect(dataset._id || dataset.id || "")}
                        className={cn(
                          "w-full text-left p-3 rounded-md border transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <div className="font-medium">{dataset.version || "Unversioned"}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Test: {dataset.testCount || 0} • Total: {dataset.totalImages || 0}
                        </div>
                        {dataset.createdAt && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(dataset.createdAt).toLocaleDateString()}
                          </div>
                        )}
                      </button>
                    );
                  })}
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
                  {models.map((model) => {
                    const isSelected =
                      model._id === selectedModelId || model.modelId === selectedModelId;
                    return (
                      <button
                        key={model._id || model.modelId}
                        onClick={() => handleModelSelect(model._id || model.modelId || "")}
                        className={cn(
                          "w-full text-left p-3 rounded-md border transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <div className="font-medium">
                          {model.modelVersion || model.modelId || "Unnamed Model"}
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

            <Button
              onClick={handleStartInference}
              disabled={!selectedProjectId || !selectedDatasetId || !selectedModelId || startingInference}
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
          </CardContent>
        </Card>
      )}

      {/* Progress Section */}
      {inferenceStatus !== "idle" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Inference Progress</CardTitle>
              {getStatusBadge()}
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
                            <tr key={idx} className="border-b">
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
                        <div key={idx} className="space-y-2">
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
            <Button
              onClick={() => {
                setInferenceId(null);
                setInferenceStatus("idle");
                setInferenceProgress(0);
                setResults(null);
                clearStorage();
              }}
              className="mt-4"
              variant="outline"
            >
              Start New Inference
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PredictionPage;
