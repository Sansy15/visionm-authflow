import React, { useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/pages/PageHeader";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { fadeInUpVariants } from "@/utils/animations";

export const AccountProfilePage: React.FC = () => {
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Update your personal information"
        actions={
          <Button onClick={() => setShowProfileDialog(true)}>
            Edit Profile
          </Button>
        }
      />

      <motion.div className="p-4 border rounded-lg" variants={fadeInUpVariants} initial="hidden" animate="visible">
        <p className="text-sm text-muted-foreground">
          Click "Edit Profile" to update your name, email, phone, and other personal information.
        </p>
      </motion.div>

      <UserProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
      />
    </div>
  );
};






