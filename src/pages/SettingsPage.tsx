import React from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader } from "@/components/pages/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Building2, CreditCard, BarChart3, ArrowRight } from "lucide-react";
import { LoadingState } from "@/components/pages/LoadingState";

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { sessionReady, user, profile, loading } = useProfile();

  if (!sessionReady || loading) {
    return <LoadingState message="Loading settings..." />;
  }

  if (sessionReady && !user) {
    return null; // Will be redirected by ProtectedRoutes
  }

  if (!profile?.company_id) {
    return (
      <div>
        <PageHeader title="Settings" description="Manage your workspace settings" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              You need to be part of a workspace to access settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Workspace Settings"
        description="Manage your workspace configuration and preferences"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/dashboard/settings/workspace")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Workspace</CardTitle>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>
              Manage workspace name, email, and admin settings
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/dashboard/settings/billing")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Billing & Subscription</CardTitle>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>
              View your subscription plan and billing information
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/dashboard/settings/usage")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Usage & Limits</CardTitle>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>
              Monitor your workspace usage and limits
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};


