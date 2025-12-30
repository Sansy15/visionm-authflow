import React from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/pages/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Bell, Palette } from "lucide-react";
import { fadeInUpVariants } from "@/utils/animations";

export const AccountPreferencesPage: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Preferences"
        description="Customize your app experience"
      />

      <motion.div className="space-y-4" variants={fadeInUpVariants} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>
              Manage your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Notification settings coming soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>
              Customize the look and feel of the app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Theme settings coming soon
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};






