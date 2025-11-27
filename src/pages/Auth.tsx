import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().regex(/^[A-Za-z\s]+$/, "Name must contain only letters"),
  phone: z.string().min(10, "Phone number is too short"),
  email: z
    .string()
    .email("Invalid email")
    .refine((email) => {
      const domain = email.split("@")[1]?.toLowerCase();
      if (!domain) return false;

      // TEMP RULE:
      // - Allow any Gmail address
      // - Allow any company domain
      // - Block some common free providers (Yahoo, Hotmail, Outlook)
      if (domain === "gmail.com") return true;

      const blockedFreeDomains = ["yahoo.com", "hotmail.com", "outlook.com"];
      return !blockedFreeDomains.includes(domain);
    }, "Please use Gmail or a company email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// convenient aliases for calling edge functions via fetch
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    (searchParams.get("mode") as "signin" | "signup" | "forgot") || "signin",
  );

  // Signup form
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [joinWorkspace, setJoinWorkspace] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  // Signin form
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  // Forgot password
  const [resetEmail, setResetEmail] = useState("");

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    calculatePasswordStrength(password);
  }, [password]);

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      // Check if user is verified
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_verified")
        .eq("id", session.user.id)
        .single();

      if (profile?.is_verified) {
        navigate("/dashboard");
      }
    }
  };

  const calculatePasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) strength += 25;
    if (/\d/.test(pwd)) strength += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 10;
    setPasswordStrength(Math.min(strength, 100));
  };

  const getPasswordColor = () => {
    if (passwordStrength < 30) return "bg-destructive";
    if (passwordStrength < 60) return "bg-warning";
    return "bg-success";
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullPhone = countryCode + phone;
      const validation = signupSchema.safeParse({
        name,
        phone: fullPhone,
        email,
        password,
      });

      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone: fullPhone,
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // ---- Send verification email via Edge Function (Resend) ----
        const verifyRes = await fetch(
          `${SUPABASE_URL}/functions/v1/send-verification-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ userId: data.user.id, email }),
          },
        );

        if (!verifyRes.ok) {
          const errBody = await verifyRes.json().catch(() => ({}));
          console.error(
            "send-verification-email failed",
            verifyRes.status,
            errBody,
          );
          throw new Error(
            errBody?.error || "Failed to send verification email",
          );
        }

        // ---- If joining workspace, send workspace request ----
        if (joinWorkspace && companyName && adminEmail) {
          const wsRes = await fetch(
            `${SUPABASE_URL}/functions/v1/send-workspace-request`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                userId: data.user.id,
                companyName,
                adminEmail,
              }),
            },
          );

          if (!wsRes.ok) {
            const errBody = await wsRes.json().catch(() => ({}));
            console.error(
              "send-workspace-request failed",
              wsRes.status,
              errBody,
            );
            throw new Error(
              errBody?.error || "Failed to send workspace request",
            );
          }
        }

        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signinEmail,
        password: signinPassword,
      });

      if (error) throw error;

      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_verified, company_id")
          .eq("id", data.user.id)
          .single();

        if (!profile?.is_verified) {
          await supabase.auth.signOut();
          toast({
            title: "Email not verified",
            description: "Please verify your email before logging in.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: "Password reset email sent",
        description: "Check your email for the reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">VisionM</CardTitle>
          <CardDescription className="text-center">
            {mode === "signup" && "Create your account"}
            {mode === "signin" && "Sign in to your account"}
            {mode === "forgot" && "Reset your password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="forgot">Forgot</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignin} className="space-y-4">
                <div>
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={signinEmail}
                    onChange={(e) => setSigninEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <Select value={countryCode} onValueChange={setCountryCode}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+1">+1 (US)</SelectItem>
                        <SelectItem value="+44">+44 (UK)</SelectItem>
                        <SelectItem value="+91">+91 (IN)</SelectItem>
                        <SelectItem value="+86">+86 (CN)</SelectItem>
                        <SelectItem value="+81">+81 (JP)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="1234567890"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Company Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1 h-2">
                      <div
                        className={`flex-1 rounded ${getPasswordColor()}`}
                        style={{ width: `${passwordStrength}%` }}
                      />
                      <div
                        className="flex-1 rounded bg-muted"
                        style={{ width: `${100 - passwordStrength}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Password strength:{" "}
                      {passwordStrength < 30
                        ? "Weak"
                        : passwordStrength < 60
                        ? "Medium"
                        : "Strong"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="join-workspace"
                    checked={joinWorkspace}
                    onCheckedChange={(checked) =>
                      setJoinWorkspace(checked as boolean)
                    }
                  />
                  <Label
                    htmlFor="join-workspace"
                    className="text-sm font-normal"
                  >
                    Join existing workspace
                  </Label>
                </div>

                {joinWorkspace && (
                  <div className="space-y-4 pl-6 border-l-2 border-border">
                    <div>
                      <Label htmlFor="company">Company Name</Label>
                      <Input
                        id="company"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company Inc."
                      />
                    </div>
                    <div>
                      <Label htmlFor="admin-email">Admin Email</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@company.com"
                      />
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="forgot">
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
