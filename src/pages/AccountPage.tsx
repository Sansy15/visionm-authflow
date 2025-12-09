import React from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/pages/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Shield, Settings, ArrowRight } from "lucide-react";

export const AccountPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Account Settings"
        description="Manage your account preferences and security"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/account/profile")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Profile</CardTitle>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>
              Update your personal information and preferences
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/account/security")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Security</CardTitle>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>
              Manage your password and security settings
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/account/preferences")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Preferences</CardTitle>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardDescription>
              Customize your app experience and notifications
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};



