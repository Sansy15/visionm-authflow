import React from "react";
import { motion } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader } from "@/components/pages/PageHeader";
import { EmptyState } from "@/components/pages/EmptyState";
import { LoadingState } from "@/components/pages/LoadingState";
import { CompanyMembers } from "@/components/CompanyMembers";
import { Users } from "lucide-react";
import { fadeInUpVariants } from "@/utils/animations";

export const TeamMembersPage: React.FC = () => {
  const { sessionReady, user, profile, isAdmin, loading } = useProfile();

  if (!sessionReady || loading) {
    return <LoadingState message="Loading team members..." />;
  }

  if (sessionReady && !user) {
    return null; // Will be redirected by ProtectedRoutes
  }

  if (!profile?.company_id) {
    return (
      <div>
        <PageHeader title="Team Members" description="Manage your workspace team" />
        <EmptyState
          icon={Users}
          title="No workspace"
          description="You need to be part of a workspace to view team members."
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Team Members" description="Manage your workspace team" />
        <EmptyState
          icon={Users}
          title="Access restricted"
          description="Only workspace admins can view team members."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team Members"
        description="View and manage members of your workspace"
      />
      <motion.div variants={fadeInUpVariants} initial="hidden" animate="visible">
        <CompanyMembers
          companyId={profile.company_id}
          company={profile.companies}
          isAdmin={isAdmin}
        />
      </motion.div>
    </div>
  );
};


