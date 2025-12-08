import React, { useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader } from "@/components/pages/PageHeader";
import { LoadingState } from "@/components/pages/LoadingState";
import { EmptyState } from "@/components/pages/EmptyState";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export const SettingsWorkspacePage: React.FC = () => {
  const { sessionReady, user, profile, isAdmin, loading } = useProfile();
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  if (!sessionReady || loading) {
    return <LoadingState message="Loading workspace settings..." />;
  }

  if (sessionReady && !user) {
    return null; // Will be redirected by ProtectedRoutes
  }

  if (!profile?.company_id) {
    return (
      <div>
        <PageHeader title="Workspace Settings" />
        <EmptyState
          icon={Building2}
          title="No workspace"
          description="You need to be part of a workspace to access settings."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Workspace Settings"
        description="Manage your workspace information and preferences"
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-semibold">Workspace Profile</h3>
            <p className="text-sm text-muted-foreground">
              Update workspace name and contact information
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowProfileDialog(true)}>
              Edit Workspace
            </Button>
          )}
        </div>

        {!isAdmin && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Only workspace admins can modify workspace settings.
            </p>
          </div>
        )}
      </div>

      <UserProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
      />
    </div>
  );
};


