import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const VerifyEmail = () => {
  const navigate = useNavigate();

  // Force light theme on verify email page (no dark mode)
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    return () => {
      // Restore user's theme preference when leaving (if stored)
      const stored = localStorage.getItem("visionm-theme");
      if (stored === "dark") {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/auth?mode=signin");
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, [navigate]);

  const goNow = () => {
    navigate("/auth?mode=signin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <Card className="w-full max-w-md text-center shadow-lg border border-border/70">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl text-green-600">✓</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Email verified</CardTitle>
          <CardDescription>
            Your email has been successfully verified.
            <br />
            Redirecting you to the sign in page…
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={goNow}>
            Go to Sign In now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;