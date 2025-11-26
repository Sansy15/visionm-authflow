import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    const token = searchParams.get("token");

    if (!token) {
      toast({
        title: "Invalid verification link",
        description: "The verification link is invalid or expired.",
        variant: "destructive",
      });
      setVerifying(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("email_verification_tokens")
        .select("user_id, expires_at")
        .eq("token", token)
        .single();

      if (error || !data) {
        throw new Error("Invalid token");
      }

      if (new Date(data.expires_at) < new Date()) {
        throw new Error("Token expired");
      }

      // Mark user as verified
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", data.user_id);

      if (updateError) throw updateError;

      // Delete the token
      await supabase
        .from("email_verification_tokens")
        .delete()
        .eq("token", token);

      setSuccess(true);
      toast({
        title: "Email verified!",
        description: "Your email has been successfully verified. You can now sign in.",
      });

      setTimeout(() => {
        navigate("/auth");
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Email Verification</CardTitle>
          <CardDescription className="text-center">
            {verifying && "Verifying your email..."}
            {!verifying && success && "Your email has been verified!"}
            {!verifying && !success && "Verification failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {verifying && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          )}

          {!verifying && success && (
            <div>
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-muted-foreground">
                Redirecting to sign in page...
              </p>
            </div>
          )}

          {!verifying && !success && (
            <Button onClick={() => navigate("/auth")}>
              Go to Sign In
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
