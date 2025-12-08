import React from "react";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader } from "@/components/pages/PageHeader";
import { EmptyState } from "@/components/pages/EmptyState";
import { LoadingState } from "@/components/pages/LoadingState";
import { Mail } from "lucide-react";

export const TeamInvitationsPage: React.FC = () => {
  const { sessionReady, user, profile, isAdmin, loading } = useProfile();

  if (!sessionReady || loading) {
    return <LoadingState message="Loading invitations..." />;
  }

  if (sessionReady && !user) {
    return null; // Will be redirected by ProtectedRoutes
  }

  if (!profile?.company_id) {
    return (
      <div>
        <PageHeader title="Invitations" description="Manage workspace invitations" />
        <EmptyState
          icon={Mail}
          title="No workspace"
          description="You need to be part of a workspace to view invitations."
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Invitations" description="Manage workspace invitations" />
        <EmptyState
          icon={Mail}
          title="Access restricted"
          description="Only workspace admins can view invitations."
        />
      </div>
    );
  }

  // TODO: Implement invitations list
  return (
    <div>
      <PageHeader
        title="Invitations"
        description="View and manage pending workspace invitations"
      />
      <EmptyState
        icon={Mail}
        title="No invitations"
        description="Pending invitations will appear here."
      />
    </div>
  );
};


