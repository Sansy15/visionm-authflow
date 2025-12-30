import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { fadeInUpVariants, staggerContainerVariants } from "@/utils/animations";
import { FolderKanban, Database, CheckCircle2, Clock, Upload, Settings, Camera } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { QuickActionCard } from "./QuickActionCard";
import { ActivityFeed } from "./ActivityFeed";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useToast } from "@/hooks/use-toast";

interface DashboardOverviewProps {
  projects: any[];
  profile: any;
  onCreateProject?: () => void; // Optional handler for creating project (opens dialog in Dashboard)
}

/**
 * DashboardOverview Component
 * 
 * Main overview section for the dashboard when user has a company.
 * Contains:
 * - Key metrics cards (Active Projects, Datasets, Last Prediction)
 * - Quick actions section (Create Project, Upload Dataset, Start Training, Run Prediction)
 * - Recent activity feed
 * 
 * @param projects - Array of projects for the user's company
 * @param profile - User profile data
 */
export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  projects,
  profile,
  onCreateProject,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    activeProjects,
    projectsThisWeek,
    datasets,
    newDatasets,
    lastPrediction,
    loading,
    error,
  } = useDashboardMetrics(projects, profile?.company_id || null);

  // Format last prediction display
  const lastPredictionDisplay = lastPrediction?.imagesAnalyzed
    ? `${lastPrediction.imagesAnalyzed} images analyzed`
    : "No predictions yet → Run your first prediction";

  const lastPredictionSubtitle = lastPrediction?.status
    ? `Status: ${lastPrediction.status.charAt(0).toUpperCase() + lastPrediction.status.slice(1)}`
    : lastPrediction?.imagesAnalyzed
    ? "Status: Completed"
    : undefined;

  // Quick action handlers
  const handleCreateProject = () => {
    if (onCreateProject) {
      onCreateProject();
    } else {
      // Fallback: navigate to create project action
      navigate("/dashboard?action=create-project");
    }
  };

  const handleUploadDataset = () => {
    if (projects.length === 0) {
      toast({
        title: "No projects available",
        description: "Please create a project first before uploading a dataset.",
        variant: "destructive",
      });
      // Optionally navigate to create project
      if (onCreateProject) {
        onCreateProject();
      } else {
        navigate("/dashboard?action=create-project");
      }
      return;
    }
    // Navigate to the first project's dataset manager, or let user choose
    // For now, navigate to first project
    navigate(`/dataset/${projects[0].id}`);
  };

  const handleStartTraining = () => {
    navigate("/dashboard?view=simulation");
  };

  const handleRunPrediction = () => {
    navigate("/project/prediction");
  };

  return (
    <motion.div
      className="space-y-8 transition-colors duration-300 ease-in-out"
      role="main"
      aria-label="Dashboard overview"
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Key Metrics Cards */}
      <motion.section aria-label="Key metrics" variants={fadeInUpVariants}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <MetricCard
            title="Active Projects"
            value={activeProjects}
            subtitle={projectsThisWeek > 0 ? `${projectsThisWeek} this week` : undefined}
            icon={FolderKanban}
            iconColor="text-blue-600 dark:text-blue-400"
            loading={loading}
            error={!!error}
            accentColor="blue"
          />
          <MetricCard
            title="Datasets"
            value={datasets}
            subtitle={newDatasets > 0 ? `${newDatasets} new` : undefined}
            icon={Database}
            iconColor="text-green-600 dark:text-green-400"
            loading={loading}
            error={!!error}
            accentColor="green"
          />
          <MetricCard
            title="Last Prediction"
            value={lastPredictionDisplay}
            subtitle={lastPredictionSubtitle}
            icon={lastPrediction?.status === "completed" || lastPrediction?.imagesAnalyzed ? CheckCircle2 : Clock}
            iconColor={
              lastPrediction?.status === "completed" || lastPrediction?.imagesAnalyzed
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground"
            }
            loading={loading}
            error={false} // Don't show error for predictions (optional data)
            accentColor="primary"
          />
        </div>
      </motion.section>

      {/* Quick Actions and Activity Feed Row */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
        variants={fadeInUpVariants}
      >
        {/* Quick Actions - takes 2 columns on large screens */}
        <section className="lg:col-span-2" aria-label="Quick actions">
          <h2 className="text-lg font-semibold mb-5 text-foreground">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickActionCard
              title="Create New Project"
              description="Set up a new computer vision project."
              icon={FolderKanban}
              onClick={handleCreateProject}
              isPrimary={true}
            />
            <QuickActionCard
              title="Upload Dataset"
              description="Add images and annotations for training."
              icon={Upload}
              onClick={handleUploadDataset}
              disabled={projects.length === 0}
            />
            <QuickActionCard
              title="Start Training"
              description="Begin training a new AI model."
              icon={Settings}
              onClick={handleStartTraining}
            />
            <QuickActionCard
              title="Run Prediction"
              description="Analyze new data with your models."
              icon={Camera}
              onClick={handleRunPrediction}
            />
          </div>
        </section>

        {/* Activity Feed - takes 1 column on large screens */}
        <aside className="lg:col-span-1">
          <ActivityFeed 
            projects={projects}
            companyId={profile?.company_id || null}
          />
        </aside>
      </motion.div>
    </motion.div>
  );
};

