import React from "react";
import { motion } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader } from "@/components/pages/PageHeader";
import { LoadingState } from "@/components/pages/LoadingState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart3 } from "lucide-react";
import { fadeInUpVariants } from "@/utils/animations";

export const SettingsUsagePage: React.FC = () => {
  const { sessionReady, user, profile, loading } = useProfile();

  if (!sessionReady || loading) {
    return <LoadingState message="Loading usage information..." />;
  }

  if (sessionReady && !user) {
    return null; // Will be redirected by ProtectedRoutes
  }

  // Placeholder data - replace with actual usage data when backend is ready
  const usageData = [
    {
      label: "Projects",
      used: 3,
      limit: 5,
      unit: "projects",
    },
    {
      label: "Storage",
      used: 2.5,
      limit: 10,
      unit: "GB",
    },
    {
      label: "Team Members",
      used: 4,
      limit: 10,
      unit: "members",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Usage & Limits"
        description="Monitor your workspace usage and limits"
      />

      <motion.div className="space-y-4" variants={fadeInUpVariants} initial="hidden" animate="visible">
        {usageData.map((item) => {
          const percentage = (item.used / item.limit) * 100;
          return (
            <Card key={item.label}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{item.label}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {item.used} / {item.limit} {item.unit}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={percentage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {percentage.toFixed(0)}% of limit used
                </p>
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle>Usage Analytics</CardTitle>
            <CardDescription>Detailed usage statistics and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>Analytics dashboard coming soon</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};


