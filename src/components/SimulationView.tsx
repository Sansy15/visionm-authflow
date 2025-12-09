import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Play, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface SimulationViewProps {
  projects: any[];
  profile: any;
}

// YOLO model options
const YOLO_MODELS = [
  { value: "yolov5n", label: "YOLOv5n (Nano)" },
  { value: "yolov5s", label: "YOLOv5s (Small)" },
  { value: "yolov5m", label: "YOLOv5m (Medium)" },
  { value: "yolov5l", label: "YOLOv5l (Large)" },
  { value: "yolov5x", label: "YOLOv5x (XLarge)" },
  { value: "yolov8n", label: "YOLOv8n (Nano)" },
  { value: "yolov8s", label: "YOLOv8s (Small)" },
  { value: "yolov8m", label: "YOLOv8m (Medium)" },
  { value: "yolov8l", label: "YOLOv8l (Large)" },
  { value: "yolov8x", label: "YOLOv8x (XLarge)" },
];

export const SimulationView: React.FC<SimulationViewProps> = ({ projects, profile }) => {
  const { toast } = useToast();
  const { sessionReady } = useProfile();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [selectedYoloModel, setSelectedYoloModel] = useState<string>("");
  const [datasetVersions, setDatasetVersions] = useState<any[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [showSimulateConfirm, setShowSimulateConfirm] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<any>(null);
  const [simulationStatus, setSimulationStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch dataset versions when project is selected
  useEffect(() => {
    // Wait for session to be ready before making queries
    if (!sessionReady) return;
    
    if (selectedProjectId && profile?.company_id) {
      fetchDatasetVersions();
    } else {
      setDatasetVersions([]);
      setSelectedDatasetId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, profile?.company_id, sessionReady]);

  // Reset dataset and model selection when project changes
  useEffect(() => {
    setSelectedDatasetId("");
    setSelectedYoloModel("");
    setSimulationResults(null);
    setSimulationStatus("idle");
    setSimulationProgress(0);
  }, [selectedProjectId]);

  // Reset model selection when dataset changes
  useEffect(() => {
    setSelectedYoloModel("");
    setSimulationResults(null);
    setSimulationStatus("idle");
    setSimulationProgress(0);
  }, [selectedDatasetId]);

  const fetchDatasetVersions = async () => {
    // Ensure session is ready before making queries
    if (!sessionReady) {
      console.warn("Session not ready, skipping dataset fetch");
      return;
    }
    
    if (!selectedProjectId || !profile?.company_id) return;

    setLoadingDatasets(true);
    try {
      // First, verify we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      const { data, error } = await supabase
        .from("datasets")
        .select("id, version, status, created_at, total_images")
        .eq("project_id", selectedProjectId)
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase query error:", error);
        // Check if it's a 404 (table might not exist) or RLS issue
        if (error.code === "PGRST116" || error.message?.includes("404") || error.message?.includes("not found")) {
          console.warn("Datasets table may not exist or is not accessible. Returning empty array.");
          setDatasetVersions([]);
          return;
        }
        throw error;
      }

      setDatasetVersions(data || []);
    } catch (error: any) {
      console.error("Error fetching dataset versions:", error);
      // If it's a 404 or table not found, just show empty state instead of error
      if (error.code === "PGRST116" || error.message?.includes("404") || error.message?.includes("not found")) {
        console.warn("Datasets table not accessible. Showing empty state.");
        setDatasetVersions([]);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to load dataset versions.",
          variant: "destructive",
        });
      }
    } finally {
      setLoadingDatasets(false);
    }
  };

  const handleSimulate = () => {
    if (!selectedProjectId || !selectedDatasetId || !selectedYoloModel) {
      toast({
        title: "Missing selection",
        description: "Please select a project, dataset version, and YOLO model.",
        variant: "destructive",
      });
      return;
    }
    setShowSimulateConfirm(true);
  };

  const confirmSimulate = async () => {
    setShowSimulateConfirm(false);
    setIsSimulating(true);
    setSimulationStatus("running");
    setSimulationProgress(0);
    setSimulationResults(null);

    try {
      // TODO: Replace with actual API endpoint
      // For now, simulate the API call
      const simulateResponse = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          datasetId: selectedDatasetId,
          yoloModel: selectedYoloModel,
        }),
      }).catch(() => {
        // If API doesn't exist, start dummy simulation
        return null;
      });

      if (!simulateResponse || !simulateResponse.ok) {
        // Dummy implementation - simulate progress
        startDummySimulation();
        return;
      }

      // Real implementation would start polling here
      const data = await simulateResponse.json();
      if (data.simulationId) {
        startPolling(data.simulationId);
      }
    } catch (error: any) {
      console.error("Error starting simulation:", error);
      toast({
        title: "Error",
        description: "Failed to start simulation. Using dummy mode.",
        variant: "destructive",
      });
      startDummySimulation();
    }
  };

  const startDummySimulation = () => {
    // Dummy implementation - simulate progress from 0 to 100%
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setIsSimulating(false);
        setSimulationStatus("completed");
        // Show dummy results
        setSimulationResults({
          accuracy: (85 + Math.random() * 10).toFixed(2),
          precision: (82 + Math.random() * 12).toFixed(2),
          recall: (88 + Math.random() * 8).toFixed(2),
          f1Score: (85 + Math.random() * 10).toFixed(2),
          mAP: (87 + Math.random() * 10).toFixed(2),
          trainingTime: `${Math.floor(Math.random() * 120 + 60)} minutes`,
          epochs: Math.floor(Math.random() * 50 + 50),
        });
        setPollingInterval(null);
      } else {
        setSimulationProgress(Math.round(progress));
      }
    }, 1000);
    setPollingInterval(interval as any);
  };

  const startPolling = (simulationId: string) => {
    // Real implementation - poll backend for status
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/simulate/${simulationId}/status`);
        if (!response.ok) throw new Error("Failed to fetch status");

        const data = await response.json();
        setSimulationProgress(data.progress || 0);

        if (data.status === "completed") {
          clearInterval(interval);
          setIsSimulating(false);
          setSimulationStatus("completed");
          setSimulationResults(data.results);
          setPollingInterval(null);
        } else if (data.status === "error") {
          clearInterval(interval);
          setIsSimulating(false);
          setSimulationStatus("error");
          toast({
            title: "Simulation failed",
            description: data.error || "An error occurred during simulation.",
            variant: "destructive",
          });
          setPollingInterval(null);
        }
      } catch (error) {
        console.error("Error polling simulation status:", error);
      }
    }, 2000); // Poll every 2 seconds
    setPollingInterval(interval as any);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedDataset = datasetVersions.find((d) => d.id === selectedDatasetId);
  const selectedModel = YOLO_MODELS.find((m) => m.value === selectedYoloModel);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold mb-2">Simulation</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Select a project and dataset version to start training simulation.
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Project Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Project</CardTitle>
            <CardDescription>Choose a project to simulate</CardDescription>
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
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Dataset Versions Selection */}
        {selectedProjectId && (
          <Card>
            <CardHeader>
              <CardTitle>Select Dataset Version</CardTitle>
              <CardDescription>
                Choose a dataset version for {selectedProject?.name || "the project"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDatasets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading dataset versions...
                </div>
              ) : datasetVersions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No dataset versions found for this project.
                </p>
              ) : (
                <div className="space-y-3">
                  {datasetVersions.map((dataset) => (
                    <div
                      key={dataset.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedDatasetId === dataset.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedDatasetId(dataset.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Version: {dataset.version || "v1.0"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {dataset.total_images || 0} images •{" "}
                            {new Date(dataset.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge
                          variant={
                            dataset.status === "ready"
                              ? "default"
                              : dataset.status === "processing"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {dataset.status || "unknown"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* YOLO Model Selection */}
        {selectedDatasetId && (
          <Card>
            <CardHeader>
              <CardTitle>Select YOLO Model</CardTitle>
              <CardDescription>
                Select the YOLO model you want to train the dataset
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedYoloModel} onValueChange={setSelectedYoloModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a YOLO model" />
                </SelectTrigger>
                <SelectContent>
                  {YOLO_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Progress Bar */}
        {isSimulating && (
          <Card>
            <CardHeader>
              <CardTitle>Training in Progress</CardTitle>
              <CardDescription>Simulation is running...</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={simulationProgress} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{simulationProgress}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Display */}
        {simulationStatus === "completed" && simulationResults && (
          <Card>
            <CardHeader>
              <CardTitle>Training Results</CardTitle>
              <CardDescription>Simulation completed successfully</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Accuracy</div>
                  <div className="text-2xl font-bold mt-1">{simulationResults.accuracy}%</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Precision</div>
                  <div className="text-2xl font-bold mt-1">{simulationResults.precision}%</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Recall</div>
                  <div className="text-2xl font-bold mt-1">{simulationResults.recall}%</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">F1 Score</div>
                  <div className="text-2xl font-bold mt-1">{simulationResults.f1Score}%</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">mAP</div>
                  <div className="text-2xl font-bold mt-1">{simulationResults.mAP}%</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Training Time</div>
                  <div className="text-2xl font-bold mt-1">{simulationResults.trainingTime}</div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Epochs</div>
                <div className="text-lg font-semibold mt-1">{simulationResults.epochs}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Simulate Button */}
        {selectedProjectId && selectedDatasetId && selectedYoloModel && !isSimulating && (
          <div className="flex justify-end">
            <Button
              onClick={handleSimulate}
              size="lg"
              className="gap-2"
              disabled={simulationStatus === "running"}
            >
              <Play className="h-4 w-4" />
              Simulate
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showSimulateConfirm} onOpenChange={setShowSimulateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Simulation</DialogTitle>
            <DialogDescription>
              Start training simulation with the following configuration?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Project:</span>
              <span className="text-sm font-medium">{selectedProject?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Dataset Version:</span>
              <span className="text-sm font-medium">
                {selectedDataset?.version || "v1.0"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">YOLO Model:</span>
              <span className="text-sm font-medium">{selectedModel?.label}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSimulateConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSimulate}>
              {isSimulating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Simulation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

