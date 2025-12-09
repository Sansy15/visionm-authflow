import React from "react";
import { PageHeader } from "@/components/pages/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Key } from "lucide-react";

export const AccountSecurityPage: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Security"
        description="Manage your account security settings"
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Password</CardTitle>
            </div>
            <CardDescription>
              Change your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Change Password</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
            <CardDescription>
              Add an extra layer of security to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">2FA is not enabled</span>
              <Button variant="outline" disabled>
                Enable 2FA
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Two-factor authentication coming soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Active Sessions</CardTitle>
            </div>
            <CardDescription>
              Manage your active login sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Session management coming soon
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};



