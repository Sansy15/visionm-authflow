// SimulationView.tsx
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Play, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";

interface SimulationViewProps {
  projects: any[];
  profile: any;
}

// single, safe API base resolution for Vite with fallback
const API_BASE: string =
  ((typeof import.meta !== "undefined" && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE_URL) as string) ||
  "/api";

console.info("[SimulationView] API_BASE =", API_BASE);

// fallback static YOLO list (used only if base-models fetch fails)
const FALLBACK_YOLO_MODELS = [
  { size: "n", label: "YOLOv8 Nano (n)" },
  { size: "s", label: "YOLOv8 Small (s)" },
  { size: "m", label: "YOLOv8 Medium (m)" },
  { size: "l", label: "YOLOv8 Large (l)" },
  { size: "x", label: "YOLOv8 XLarge (x)" },
];

export const SimulationView: React.FC<SimulationViewProps> = ({ projects, profile }) => {
  const { toast } = useToast();
  const { sessionReady } = useProfile();

  // selections
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [datasetList, setDatasetList] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [datasetDetails, setDatasetDetails] = useState<any | null>(null);

  // model selection states
  const [modelType, setModelType] = useState<"YOLO" | "EfficientNet" | "Custom">("YOLO");
  const [baseModels, setBaseModels] = useState<Array<{ filename?: string; size: string; name?: string; sizeMB?: number; label?: string }>>([]);
  const [selectedModelSize, setSelectedModelSize] = useState<string>(""); // 'n'|'s'|'m'|'l'|'x'

  // defaults and hyperparams
  const [defaultParams, setDefaultParams] = useState<any | null>(null);
  const [useDefaults, setUseDefaults] = useState<boolean>(true);
  const [epochs, setEpochs] = useState<number>(100);
  const [batchSize, setBatchSize] = useState<number>(16);
  const [imgSize, setImgSize] = useState<number>(640);
  const [learningRate, setLearningRate] = useState<number>(0.01);
  const [workers, setWorkers] = useState<number>(4);

  // UI / loading / job state
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingDatasetDetails, setLoadingDatasetDetails] = useState(false);
  const [showSimulateConfirm, setShowSimulateConfirm] = useState(false);

  const [isSimulating, setIsSimulating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [simulationStatus, setSimulationStatus] = useState<
    "idle" | "queued" | "running" | "completed" | "failed" | "cancelled"
  >("idle");
  const [simulationMetrics, setSimulationMetrics] = useState<any | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // refs
  const pollIntervalRef = useRef<number | null>(null);
  const logsAbortRef = useRef<AbortController | null>(null);
  const datasetDetailsAbortRef = useRef<AbortController | null>(null);

  // helper headers
  const getFetchHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (profile?.access_token) {
      headers["Authorization"] = `Bearer ${profile.access_token}`;
    }
    return headers;
  };

  // --- fetch list of ready datasets for selected project ---
  const fetchDatasets = async (projectId: string) => {
    if (!projectId || !sessionReady) {
      setDatasetList([]);
      return;
    }
    setLoadingDatasets(true);
    try {
      // find project object to get its canonical name if available
      const selectedProjectObj = projects.find(
        (p) => String(p.id) === String(projectId) || String(p.name) === String(projectId)
      );
      const projectName = selectedProjectObj?.name ?? "";

      // request both projectId and project name as query params (server may accept either)
      const qs = new URLSearchParams({
        status: "ready",
        ...(projectId ? { projectId: String(projectId) } : {}),
        ...(projectName ? { project: String(projectName) } : {}),
      });
      const url = `${API_BASE}/datasets?${qs.toString()}`;
      console.info("[fetchDatasets] url:", url, { selectedProjectObj });

      const resp = await fetch(url, { headers: getFetchHeaders() });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "<unreadable>");
        console.warn("[fetchDatasets] non-ok response:", resp.status, body);
        if (resp.status === 404) {
          setDatasetList([]);
          return;
        }
        throw new Error(`Failed to load datasets: ${resp.status}`);
      }

      const contentType = resp.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await resp.text().catch(() => "");
        console.error("[fetchDatasets] non-json response body:", text);
        toast({
          title: "Server error",
          description: "Datasets endpoint returned non-JSON. Check server logs / network tab.",
          variant: "destructive",
        });
        setDatasetList([]);
        return;
      }

      const json = await resp.json();
      const rawList = Array.isArray(json) ? json : json.datasets ?? [];
      console.info("[fetchDatasets] raw count:", rawList.length);

      // defensive client-side filter: match dataset to selected project by any common fields
      const filtered = rawList.filter((d: any) => {
        // collect possible project-identifying fields from dataset record
        const projectFields = [
          d.project,
          d.projectId,
          d.project_id,
          d.project_uuid,
          d.projectName,
          d.project_name,
          d.company,
        ]
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v));

        const matchesName = projectName ? projectFields.includes(String(projectName)) : false;
        const matchesId = projectId ? projectFields.includes(String(projectId)) : false;

        // If project fields are empty (server didn't include project info), accept all (server likely filtered)
        const hasProjectFields = projectFields.length > 0;

        return hasProjectFields ? (matchesName || matchesId) : true;
      });

      console.info(`[fetchDatasets] filtered -> ${filtered.length} of ${rawList.length}`);

      // normalize id to _id string for client usage
      const normalized = filtered.map((d: any) => {
        const rawId = d._id ?? d.id ?? d.datasetId ?? d.uuid ?? d._id_str ?? "";
        return { ...d, _id: rawId !== undefined && rawId !== null ? String(rawId) : "" };
      });

      setDatasetList(normalized);
    } catch (err: any) {
      console.error("fetchDatasets error:", err);
      toast({
        title: "Failed to load datasets",
        description: err?.message ?? "Could not fetch datasets.",
        variant: "destructive",
      });
      setDatasetList([]);
    } finally {
      setLoadingDatasets(false);
    }
  };

  // --- fetch dataset details ---
  const fetchDatasetDetails = async (datasetId: string) => {
    if (!datasetId || !sessionReady) {
      setDatasetDetails(null);
      return;
    }
    setLoadingDatasetDetails(true);

    if (datasetDetailsAbortRef.current) {
      datasetDetailsAbortRef.current.abort();
      datasetDetailsAbortRef.current = null;
    }
    const abort = new AbortController();
    datasetDetailsAbortRef.current = abort;

    try {
      const url = `${API_BASE}/dataset/${encodeURIComponent(datasetId)}`;
      console.info("[fetchDatasetDetails] url:", url);

      const resp = await fetch(url, { headers: getFetchHeaders(), signal: abort.signal });

      if (!resp.ok) {
        if (resp.status === 404) {
          setDatasetDetails(null);
          return;
        }
        const text = await resp.text().catch(() => "");
        console.error("[fetchDatasetDetails] non-ok:", resp.status, text);
        throw new Error(`Failed to fetch dataset (${resp.status})`);
      }

      const contentType = resp.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await resp.text().catch(() => "");
        console.error("[fetchDatasetDetails] non-json response body:", text);
        toast({
          title: "Server error",
          description: "Dataset details endpoint returned non-JSON. Check server logs.",
          variant: "destructive",
        });
        setDatasetDetails(null);
        return;
      }

      const json = await resp.json();
      setDatasetDetails(json);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("fetchDatasetDetails error:", err);
      toast({
        title: "Failed to load dataset details",
        description: err?.message ?? "Could not fetch dataset details.",
        variant: "destructive",
      });
      setDatasetDetails(null);
    } finally {
      setLoadingDatasetDetails(false);
      datasetDetailsAbortRef.current = null;
    }
  };

  // --- fetch base models (YOLO) ---
  const fetchBaseModels = async () => {
    try {
      const url = `${API_BASE}/train/base-models`;
      console.info("[fetchBaseModels] url:", url);
      const resp = await fetch(url, { headers: getFetchHeaders() });

      if (!resp.ok) {
        console.warn("[fetchBaseModels] non-ok:", resp.status);
        setBaseModels(FALLBACK_YOLO_MODELS);
        return;
      }

      const contentType = resp.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        console.warn("[fetchBaseModels] non-json response");
        setBaseModels(FALLBACK_YOLO_MODELS);
        return;
      }

      const json = await resp.json();
      const models = Array.isArray(json.models) && json.models.length > 0
        ? json.models.map((m: any) => ({
            size: m.size ?? m.sizeMB ?? m.filename ?? "",
            name: m.name ?? m.filename ?? `model-${m.size ?? ""}`,
            sizeMB: m.sizeMB,
            filename: m.filename,
            label: m.name ? `${m.name}${m.sizeMB ? ` (${m.sizeMB} MB)` : ""}` : (m.filename ?? "")
          }))
        : FALLBACK_YOLO_MODELS;
      setBaseModels(models);
    } catch (err) {
      console.error("fetchBaseModels error:", err);
      setBaseModels(FALLBACK_YOLO_MODELS);
    }
  };

  // --- fetch default hyperparameters for selected modelType ---
  const fetchDefaultParams = async (mType: string) => {
    try {
      const url = `${API_BASE}/train/defaults?modelType=${encodeURIComponent(mType)}`;
      console.info("[fetchDefaultParams] url:", url);
      const resp = await fetch(url, { headers: getFetchHeaders() });

      if (!resp.ok) {
        console.warn("[fetchDefaultParams] non-ok:", resp.status);
        setDefaultParams(null);
        return;
      }

      const contentType = resp.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        console.warn("[fetchDefaultParams] non-json response");
        setDefaultParams(null);
        return;
      }

      const json = await resp.json();
      const defs = json.defaults ?? null;
      setDefaultParams(defs);

      // Apply defaults to inputs if useDefaults is true
      if (defs) {
        if (useDefaults) {
          setEpochs(Number(defs.epochs ?? 100));
          setBatchSize(Number(defs.batchSize ?? 16));
          setImgSize(Number(defs.imgSize ?? 640));
          setLearningRate(Number(defs.learningRate ?? 0.01));
          setWorkers(Number(defs.workers ?? 4));
        }
      }
    } catch (err) {
      console.error("fetchDefaultParams error:", err);
      setDefaultParams(null);
    }
  };

  // when project changes, load datasets
  useEffect(() => {
    setSelectedDatasetId("");
    setDatasetDetails(null);
    setSelectedModelSize("");
    setSimulationMetrics(null);
    setSimulationStatus("idle");
    setJobId(null);
    setSimulationProgress(0);
    if (selectedProjectId) {
      void fetchDatasets(selectedProjectId);
    } else {
      setDatasetList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, sessionReady]);

  // when dataset changes, fetch details
  useEffect(() => {
    setSelectedModelSize("");
    setSimulationMetrics(null);
    setSimulationStatus("idle");
    setJobId(null);
    setSimulationProgress(0);
    if (selectedDatasetId) {
      void fetchDatasetDetails(selectedDatasetId);
    } else {
      setDatasetDetails(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetId, sessionReady]);

  // when modelType changes => fetch defaults and base-models when YOLO
  useEffect(() => {
    // fetch default hyperparameters
    void fetchDefaultParams(modelType);

    // if YOLO, fetch model sizes
    if (modelType === "YOLO") {
      void fetchBaseModels();
    } else {
      setBaseModels([]);
      setSelectedModelSize("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelType]);

  // if useDefaults toggled ON, apply defaultParams to inputs
  useEffect(() => {
    if (useDefaults && defaultParams) {
      setEpochs(Number(defaultParams.epochs ?? 100));
      setBatchSize(Number(defaultParams.batchSize ?? 16));
      setImgSize(Number(defaultParams.imgSize ?? 640));
      setLearningRate(Number(defaultParams.learningRate ?? 0.01));
      setWorkers(Number(defaultParams.workers ?? 4));
    }
  }, [useDefaults, defaultParams]);

  // cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (logsAbortRef.current) {
        logsAbortRef.current.abort();
        logsAbortRef.current = null;
      }
      if (datasetDetailsAbortRef.current) {
        datasetDetailsAbortRef.current.abort();
        datasetDetailsAbortRef.current = null;
      }
    };
  }, []);

  // --- start training: POST /api/train ---
  const startTraining = async () => {
    if (!selectedDatasetId || !modelType) {
      toast({
        title: "Missing inputs",
        description: "Select dataset and model type before starting training.",
        variant: "destructive",
      });
      return;
    }

    // Prepare payload
    const payload: any = {
      datasetId: selectedDatasetId,
      modelType,
      ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
    };

    // Add modelSize only when YOLO and selected
    if (modelType === "YOLO" && selectedModelSize) {
      payload.modelSize = selectedModelSize; // backend expects modelSize (confirm with backend if different)
    }

    // Add hyperparameters only if user opted to customize
    if (!useDefaults) {
      payload.hyperparameters = {
        epochs,
        batchSize,
        imgSize,
        learningRate,
        workers,
      };
    }

    console.info("[startTraining] payload:", payload);

    setShowSimulateConfirm(false);
    setIsSimulating(true);
    setSimulationStatus("queued");
    setSimulationProgress(0);
    setSimulationMetrics(null);
    setLogs([]);

    try {
      const resp = await fetch(`${API_BASE}/train`, {
        method: "POST",
        headers: getFetchHeaders(),
        body: JSON.stringify(payload),
      });

      if (resp.status === 400 || resp.status === 409) {
        const json = await resp.json().catch(() => null);
        throw new Error(json?.error ?? `Server returned ${resp.status}`);
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Failed to start training (${resp.status})`);
      }

      const data = await resp.json();
      const newJobId = data.jobId ?? data.job_id ?? null;
      if (!newJobId) {
        console.warn("startTraining: missing jobId in response", data);
        throw new Error("Server did not return jobId");
      }

      setJobId(newJobId);
      setSimulationStatus(data.status ?? "queued");
      startPollingJob(newJobId);
    } catch (err: any) {
      console.error("startTraining error:", err);
      toast({
        title: "Failed to start training",
        description: err?.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
      setIsSimulating(false);
      setSimulationStatus("failed");
    }
  };

  // --- poll job status every 3s ---
  const startPollingJob = (jobIdToPoll: string) => {
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    const fetchStatusAndMaybeLogs = async () => {
      try {
        const resp = await fetch(`${API_BASE}/train/${encodeURIComponent(jobIdToPoll)}/status`, {
          headers: getFetchHeaders(),
        });
        if (!resp.ok) throw new Error(`Status fetch failed (${resp.status})`);
        const data = await resp.json();
        setSimulationStatus(data.status ?? simulationStatus);

        const progressPercent =
          data.progress?.progressPercent ??
          (() => {
            const cur = data.progress?.currentEpoch ?? 0;
            const tot = data.progress?.totalEpochs ?? 0;
            return tot ? Math.round((cur / tot) * 100) : 0;
          })();
        setSimulationProgress(progressPercent);
        setSimulationMetrics(data.metrics ?? null);

        if (data.logsSummary && Array.isArray(data.logsSummary)) {
          setLogs(data.logsSummary);
        }

        if (["completed", "failed", "cancelled"].includes(data.status)) {
          if (pollIntervalRef.current) {
            window.clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsSimulating(false);
        }
      } catch (err) {
        console.error("Polling status error:", err);
      }
    };

    void fetchStatusAndMaybeLogs();
    const id = window.setInterval(() => {
      void fetchStatusAndMaybeLogs();
    }, 3000);
    pollIntervalRef.current = id as unknown as number;
  };

  // --- fetch logs on demand ---
  const fetchLogs = async (limit = 200) => {
    if (!jobId) return;
    if (logsAbortRef.current) {
      logsAbortRef.current.abort();
      logsAbortRef.current = null;
    }
    const abort = new AbortController();
    logsAbortRef.current = abort;
    try {
      const resp = await fetch(`${API_BASE}/train/${encodeURIComponent(jobId)}/logs?limit=${limit}`, {
        headers: getFetchHeaders(),
        signal: abort.signal,
      });
      if (!resp.ok) throw new Error(`Failed to fetch logs (${resp.status})`);
      const json = await resp.json();
      setLogs(Array.isArray(json.logs) ? json.logs : json.logs ?? []);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("fetchLogs error:", err);
      toast({
        title: "Failed to load logs",
        description: err?.message ?? "Could not fetch training logs.",
        variant: "destructive",
      });
    } finally {
      logsAbortRef.current = null;
    }
  };

  // cancel job
  const cancelJob = async () => {
    if (!jobId) return;
    try {
      const resp = await fetch(`${API_BASE}/train/${encodeURIComponent(jobId)}/cancel`, {
        method: "POST",
        headers: getFetchHeaders(),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(json?.error ?? `Cancel failed (${resp.status})`);
      }
      setSimulationStatus(json?.status ?? "cancelled");
      toast({ title: "Cancelled", description: "Training cancelled.", variant: "default" });
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsSimulating(false);
    } catch (err: any) {
      console.error("cancelJob error:", err);
      toast({ title: "Cancel failed", description: err?.message ?? "Could not cancel job.", variant: "destructive" });
    }
  };

  // retry job
  const retryJob = async () => {
    if (!jobId) return;
    try {
      const resp = await fetch(`${API_BASE}/train/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
        headers: getFetchHeaders(),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error ?? `Retry failed (${resp.status})`);
      const newId = json?.jobId ?? json?.job_id ?? null;
      if (!newId) throw new Error("No new job id returned from retry.");
      setJobId(newId);
      setSimulationStatus("queued");
      setIsSimulating(true);
      setSimulationProgress(0);
      startPollingJob(newId);
      toast({ title: "Retry started", description: `New job ${newId} started`, variant: "default" });
    } catch (err: any) {
      console.error("retryJob error:", err);
      toast({ title: "Retry failed", description: err?.message ?? "Could not retry job.", variant: "destructive" });
    }
  };

  // UI helpers
  const selectedProject = projects.find(
    (p) => String(p.id) === String(selectedProjectId) || String(p.name) === String(selectedProjectId)
  );
  const selectedDataset = datasetList.find((d) => d._id === selectedDatasetId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold mb-2">Simulation (Training)</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Follow the training workflow: select dataset → choose model & hyperparameters → start training.
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Project */}
        <Card>
          <CardHeader>
            <CardTitle>Select Project</CardTitle>
            <CardDescription>Choose project scope for datasets</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 ? (
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
          </CardContent>
        </Card>

        {/* Datasets */}
        {selectedProjectId && (
          <Card>
            <CardHeader>
              <CardTitle>Select Dataset Version</CardTitle>
              <CardDescription>Choose a ready dataset for the selected project</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDatasets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading dataset versions...
                </div>
              ) : datasetList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ready datasets found for this project.</p>
              ) : (
                <div className="space-y-3">
                  {datasetList.map((dataset, index) => {
                    const id = dataset._id ?? dataset.id ?? String(index);
                    const key = id || `dataset-${index}`;
                    return (
                      <div
                        key={key}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedDatasetId === id ? "border-primary bg-primary/5" : "hover:bg-muted"
                        }`}
                        onClick={() => {
                          setSelectedDatasetId(String(id));
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedDatasetId(String(id));
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">Version: {dataset.version ?? "unknown"}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {(dataset.totalImages ?? 0) + " images"} •{" "}
                              {new Date(dataset.createdAt ?? dataset.created_at ?? Date.now()).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge
                            variant={
                              dataset.status === "ready" ? "default" : dataset.status === "processing" ? "secondary" : "destructive"
                            }
                          >
                            {dataset.status ?? "unknown"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dataset Summary */}
        {selectedDatasetId && (
          <Card>
            <CardHeader>
              <CardTitle>Dataset Summary</CardTitle>
              <CardDescription>Metadata fetched from GET /api/dataset/:datasetId</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDatasetDetails ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading dataset...
                </div>
              ) : datasetDetails ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm text-muted-foreground">Version</div>
                  <div className="font-medium">{datasetDetails.version}</div>

                  <div className="text-sm text-muted-foreground">Total Images</div>
                  <div className="font-medium">{datasetDetails.totalImages}</div>

                  <div className="text-sm text-muted-foreground">Labeled</div>
                  <div className="font-medium">{datasetDetails.labeledImages ?? datasetDetails.trainCount ?? 0}</div>

                  <div className="text-sm text-muted-foreground">Unlabeled</div>
                  <div className="font-medium">{datasetDetails.unlabeledImages ?? 0}</div>

                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium">{datasetDetails.status}</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No dataset details available.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Model Type + Model Size + Hyperparameters */}
        {selectedDatasetId && (
          <Card>
            <CardHeader>
              <CardTitle>Select Model & Hyperparameters</CardTitle>
              <CardDescription>Choose a model and tune hyperparameters</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Model type selector */}
              <div className="mb-4">
                <Label>Model Type</Label>
                <div className="mt-2 flex gap-2">
                  <Button variant={modelType === "YOLO" ? "default" : "ghost"} onClick={() => setModelType("YOLO")}>YOLO</Button>
                  <Button variant={modelType === "EfficientNet" ? "default" : "ghost"} onClick={() => setModelType("EfficientNet")}>EfficientNet</Button>
                  <Button variant={modelType === "Custom" ? "default" : "ghost"} onClick={() => setModelType("Custom")}>Custom</Button>
                </div>
              </div>

              {/* If YOLO -> show model-size dropdown */}
              {modelType === "YOLO" && (
                <div className="mb-4">
                  <Label>YOLO Base Model</Label>
                  <Select value={selectedModelSize} onValueChange={setSelectedModelSize}>
                    <SelectTrigger>
                      <SelectValue placeholder={baseModels.length ? "Select YOLO model" : "Loading models..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {baseModels.length === 0 ? (
                        <SelectItem value="fallback" disabled>
                          No models available
                        </SelectItem>
                      ) : (
                        baseModels.map((m, i) => {
                          const val = m.size ?? (m.filename ? String(m.filename) : `m-${i}`);
                          const label = m.label ?? m.name ?? String(m.filename ?? val);
                          return (
                            <SelectItem key={String(val) + "-" + i} value={String(val)}>
                              {label}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Defaults card */}
              <div className="mb-4 p-3 border rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Default Training Parameters</div>
                    <div className="text-xs text-muted-foreground">These are fetched from the backend for the selected model type.</div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={useDefaults}
                        onChange={(e) => setUseDefaults(e.target.checked)}
                      />
                      <span className="text-sm">Use defaults</span>
                    </label>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>Epochs</div>
                  <div className="font-medium">{defaultParams?.epochs ?? 100}</div>
                  <div>Batch Size</div>
                  <div className="font-medium">{defaultParams?.batchSize ?? 16}</div>
                  <div>Image Size</div>
                  <div className="font-medium">{defaultParams?.imgSize ?? 640}</div>
                  <div>Learning Rate</div>
                  <div className="font-medium">{defaultParams?.learningRate ?? 0.01}</div>
                  <div>Workers</div>
                  <div className="font-medium">{defaultParams?.workers ?? 4}</div>
                </div>
              </div>

              {/* Customization form (visible when useDefaults === false) */}
              {!useDefaults && (
                <div className="mt-2 grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <Label>Epochs</Label>
                    <input
                      type="number"
                      value={epochs}
                      min={1}
                      max={1000}
                      onChange={(e) => setEpochs(Number(e.target.value))}
                      className="w-32 input"
                    />
                  </div>
                  <div>
                    <Label>Batch Size</Label>
                    <input
                      type="number"
                      value={batchSize}
                      min={1}
                      max={512}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className="w-32 input"
                    />
                  </div>
                  <div>
                    <Label>Image Size</Label>
                    <input
                      type="number"
                      value={imgSize}
                      min={128}
                      max={2048}
                      onChange={(e) => setImgSize(Number(e.target.value))}
                      className="w-32 input"
                    />
                  </div>
                  <div>
                    <Label>Learning Rate</Label>
                    <input
                      type="number"
                      value={learningRate}
                      step={0.0001}
                      min={0.000001}
                      max={1}
                      onChange={(e) => setLearningRate(Number(e.target.value))}
                      className="w-32 input"
                    />
                  </div>
                  <div>
                    <Label>Workers</Label>
                    <input
                      type="number"
                      value={workers}
                      min={1}
                      max={64}
                      onChange={(e) => setWorkers(Number(e.target.value))}
                      className="w-32 input"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        {jobId && (
          <Card>
            <CardHeader>
              <CardTitle>Training Status</CardTitle>
              <CardDescription>Job ID: {jobId} — Status: {simulationStatus}</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={simulationProgress} />
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{simulationProgress}%</span>
              </div>

              {/* metrics */}
              {simulationMetrics && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {simulationMetrics.currentLoss !== undefined && (
                    <div className="p-3 border rounded">
                      <div className="text-sm text-muted-foreground">Loss</div>
                      <div className="font-semibold mt-1">{simulationMetrics.currentLoss}</div>
                    </div>
                  )}
                  {simulationMetrics.mAP50 !== undefined && (
                    <div className="p-3 border rounded">
                      <div className="text-sm text-muted-foreground">mAP@0.5</div>
                      <div className="font-semibold mt-1">{simulationMetrics.mAP50}</div>
                    </div>
                  )}
                </div>
              )}

              {/* logs preview */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Logs</div>
                  <div>
                    <Button size="sm" variant="outline" onClick={() => void fetchLogs(200)}>
                      Refresh logs
                    </Button>
                  </div>
                </div>
                <div className="mt-2 max-h-40 overflow-auto bg-surface p-2 rounded text-xs">
                  {logs.length === 0 ? <div className="text-muted-foreground">No logs yet.</div> : logs.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>

              {/* Cancel / Retry */}
              <div className="mt-4 flex gap-2">
                {(simulationStatus === "queued" || simulationStatus === "running") && (
                  <Button variant="destructive" onClick={cancelJob}>
                    Cancel
                  </Button>
                )}

                {(simulationStatus === "failed" || simulationStatus === "cancelled") && (
                  <Button onClick={retryJob}>Retry</Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Start Simulation CTA */}
        {selectedProjectId && selectedDatasetId && modelType && !isSimulating && !jobId && (
          <div className="flex justify-end">
            <Button onClick={() => setShowSimulateConfirm(true)} size="lg" className="gap-2">
              <Play className="h-4 w-4" />
              Start Training
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showSimulateConfirm} onOpenChange={setShowSimulateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Training</DialogTitle>
            <DialogDescription>Start training with selected configuration?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Project:</span><span className="text-sm font-medium">{selectedProject?.name}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Dataset:</span><span className="text-sm font-medium">{selectedDataset?.version ?? datasetDetails?.version}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Model Type:</span><span className="text-sm font-medium">{modelType}</span></div>
            {modelType === "YOLO" && (<div className="flex justify-between"><span className="text-sm text-muted-foreground">YOLO Size:</span><span className="text-sm font-medium">{selectedModelSize || "not selected"}</span></div>)}
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Epochs:</span><span className="text-sm font-medium">{epochs}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSimulateConfirm(false)}>Cancel</Button>
            <Button onClick={startTraining}>
              {isSimulating ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting... </> : "Confirm & Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SimulationView;
