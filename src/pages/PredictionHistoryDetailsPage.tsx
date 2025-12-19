import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/pages/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface HistoryInferenceResults {
  totalDetections: number;
  averageConfidence: number;
  detectionsByClass: Array<{
    className: string;
    count: number;
    avgConfidence?: number;
    averageConfidence?: number;
  }>;
  // Support both new structure (object with good/defect/all) and old structure (flat array)
  annotatedImages: {
    good: Array<{ filename: string; url: string; tag: 'good' }>;
    defect: Array<{ filename: string; url: string; tag: 'defect' }>;
    all: Array<{ filename: string; url: string; tag: 'good' | 'defect' | 'unreviewed' }>;
  } | Array<{
    filename: string;
    url: string;
    tag?: string;
  }>;
  statistics?: {
    total: number;
    good: number;
    defect: number;
    hasTags: boolean;
  };
}

const PredictionHistoryDetailsPage = () => {
  const { inferenceId } = useParams<{ inferenceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<HistoryInferenceResults | null>(null);
  const [imageFilter, setImageFilter] = useState<'all' | 'good' | 'defect'>('all');

  // Helper function to normalize annotated images from either structure
  const normalizeAnnotatedImages = (
    images: 
      | { good: Array<{ filename: string; url: string; tag?: string }>; defect: Array<{ filename: string; url: string; tag?: string }>; all: Array<{ filename: string; url: string; tag?: string }> }
      | Array<{ filename: string; url: string; tag?: string }>
      | undefined,
    inferenceId: string
  ): Array<{ filename: string; url: string; tag: string }> => {
    if (!images) return [];
    
    const apiBase = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
    
    // Check if new structure (object with good/defect/all)
    if (images && typeof images === 'object' && !Array.isArray(images) && 'all' in images) {
      // New structure: use 'all' array (already filtered by backend)
      const allImages = (images as { all: Array<{ filename: string; url: string; tag?: string }> }).all || [];
      return allImages.map((img) => {
        const raw = img.url || "";
        const basePath = raw.startsWith("/api/") ? raw.slice(4) : raw;
        const fullUrl = apiBase ? `${apiBase}/${basePath.replace(/^\/+/, "")}` : raw;
        return {
          ...img,
          url: fullUrl,
          tag: img.tag || 'unreviewed',
        };
      });
    } else if (Array.isArray(images)) {
      // Old structure: flat array
      return images.map((img) => {
        const raw = img.url || "";
        const basePath = raw.startsWith("/api/") ? raw.slice(4) : raw;
        const fullUrl = apiBase ? `${apiBase}/${basePath.replace(/^\/+/, "")}` : raw;
        return {
          ...img,
          url: fullUrl,
          tag: img.tag || 'unreviewed',
        };
      });
    }
    
    return [];
  };

  const fetchResults = async (filter: 'all' | 'good' | 'defect' = 'all') => {
    if (!inferenceId) return;

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const base = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
      const url =
        (base ? `${base}` : "") +
        `/inference/${encodeURIComponent(inferenceId)}/results?filter=${filter}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        toast({
          title: "Failed to load results",
          description: "Results are not ready yet or not found.",
          variant: "destructive",
        });
        return;
      }

      const response = await res.json();
      const data = response.results || response;

      // Normalize annotated images from either structure
      const normalizedImages = normalizeAnnotatedImages(data.annotatedImages, inferenceId);

      const normalized: HistoryInferenceResults = {
        ...data,
        detectionsByClass:
          (data.detectionsByClass as Array<{ className: string; count: number; avgConfidence?: number; averageConfidence?: number }> | undefined)?.map((item) => ({
            ...item,
            averageConfidence: item.avgConfidence ?? item.averageConfidence ?? 0,
          })) || [],
        annotatedImages: normalizedImages,
        statistics: data.statistics || {
          total: normalizedImages.length,
          good: 0,
          defect: 0,
          hasTags: false,
        },
      };

      setResults(normalized);
    } catch (err: unknown) {
      console.error("Error loading history results:", err);
      const errorMessage = err instanceof Error ? err.message : "Could not fetch inference results.";
      toast({
        title: "Failed to load results",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    void fetchResults(imageFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferenceId, toast]);

  // Refetch when filter changes (only for new jobs with tags)
  useEffect(() => {
    if (!results || results.statistics?.hasTags !== true) return;
    
    // Debounce to avoid too many requests
    const timeoutId = setTimeout(() => {
      void fetchResults(imageFilter);
    }, 300);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFilter, results]);

  return (
    <div className={cn("container mx-auto py-6 space-y-6")}>
      <PageHeader
        title="Inference Results"
        description="View detailed results for a completed inference job"
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/project/prediction")}
        className="px-0"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Prediction History
      </Button>

      {loading ? (
        <Card>
          <CardContent className="py-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !results ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
              Results are not available for this inference.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Results Summary</CardTitle>
              <CardDescription>
                Inference ID: {inferenceId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xl font-bold">{results.totalDetections}</div>
                  <div className="text-xs text-muted-foreground">Total Detections</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {(results.averageConfidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Average Confidence</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {results.detectionsByClass.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Classes Detected</div>
                </div>
              </div>
              {/* Statistics row for tagged inference jobs */}
              {results.statistics && results.statistics.hasTags && (
                <div className="grid gap-4 md:grid-cols-3 mt-4 pt-4 border-t">
                  <div>
                    <div className="text-xl font-bold">{results.statistics.total}</div>
                    <div className="text-xs text-muted-foreground">Total Images</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-600">{results.statistics.good}</div>
                    <div className="text-xs text-muted-foreground">Good Images</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-red-600">{results.statistics.defect}</div>
                    <div className="text-xs text-muted-foreground">Defect Images</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detections by Class */}
          {results.detectionsByClass.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Detections by Class</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Class</th>
                        <th className="text-right p-2">Count</th>
                        <th className="text-right p-2">Avg Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.detectionsByClass.map((item, idx) => (
                        <tr key={item.className || `history-class-${idx}`} className="border-b">
                          <td className="p-2 font-medium">{item.className}</td>
                          <td className="p-2 text-right">{item.count}</td>
                          <td className="p-2 text-right">
                            {(item.averageConfidence! * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Annotated Images with Filter Tabs */}
          {(() => {
            type ImageItem = { filename: string; url: string; tag?: string };
            
            // Get images array (handle both old and new structures)
            const imagesArray: ImageItem[] = Array.isArray(results.annotatedImages)
              ? results.annotatedImages
              : results.annotatedImages && typeof results.annotatedImages === 'object' && 'all' in results.annotatedImages
              ? results.annotatedImages.all
              : [];
            
            if (imagesArray.length === 0) return null;
            
            // Determine if we should show filter tabs (only for new jobs with tags)
            const showFilters = results.statistics?.hasTags === true;
            
            // Get images to display based on filter
            let imagesToDisplay: ImageItem[] = imagesArray;
            if (showFilters && imageFilter !== 'all') {
              imagesToDisplay = imagesArray.filter((img) => img.tag === imageFilter);
            }
            
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Annotated Images</CardTitle>
                  <CardDescription>
                    {showFilters
                      ? `${results.statistics?.total || imagesArray.length} total images`
                      : `${imagesArray.length} image${imagesArray.length !== 1 ? "s" : ""} with detections`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {showFilters ? (
                    <Tabs value={imageFilter} onValueChange={(value) => setImageFilter(value as 'all' | 'good' | 'defect')}>
                      <TabsList className="grid w-full max-w-md grid-cols-3 mb-4">
                        <TabsTrigger value="all">
                          All ({results.statistics?.total || 0})
                        </TabsTrigger>
                        <TabsTrigger value="good">
                          Good ({results.statistics?.good || 0})
                        </TabsTrigger>
                        <TabsTrigger value="defect">
                          Defect ({results.statistics?.defect || 0})
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="all" className="mt-0">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {imagesArray.map((img, idx) => (
                            <div
                              key={img.filename || img.url || `history-image-${idx}`}
                              className="space-y-2"
                            >
                              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                <img
                                  src={img.url}
                                  alt={img.filename}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                                {img.tag && img.tag !== 'unreviewed' && (
                                  <Badge
                                    variant="outline"
                                    className={
                                      img.tag === 'good'
                                        ? "bg-green-50 text-green-700 border-green-200 absolute top-2 right-2"
                                        : "bg-red-50 text-red-700 border-red-200 absolute top-2 right-2"
                                    }
                                  >
                                    {img.tag === 'good' ? '✅ Good' : '❌ Defect'}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {img.filename}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                      <TabsContent value="good" className="mt-0">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {imagesArray.filter((img) => img.tag === 'good').map((img, idx) => (
                            <div
                              key={img.filename || img.url || `history-image-${idx}`}
                              className="space-y-2"
                            >
                              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                <img
                                  src={img.url}
                                  alt={img.filename}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                                <Badge
                                  variant="outline"
                                  className="bg-green-50 text-green-700 border-green-200 absolute top-2 right-2"
                                >
                                  ✅ Good
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {img.filename}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                      <TabsContent value="defect" className="mt-0">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {imagesArray.filter((img) => img.tag === 'defect').map((img, idx) => (
                            <div
                              key={img.filename || img.url || `history-image-${idx}`}
                              className="space-y-2"
                            >
                              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                                <img
                                  src={img.url}
                                  alt={img.filename}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200 absolute top-2 right-2"
                                >
                                  ❌ Defect
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {img.filename}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {imagesArray.map((img, idx) => (
                        <div
                          key={img.filename || img.url || `history-image-${idx}`}
                          className="space-y-2"
                        >
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
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default PredictionHistoryDetailsPage;


