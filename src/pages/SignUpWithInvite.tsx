import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";

export default function SignUpWithInvite() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? searchParams.get("project_invite"); // support both
  const navigate = useNavigate();

  // Force light theme on sign up page (no dark mode)
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

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(!!inviteToken);
  const [inviteData, setInviteData] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) { setValidating(false); return; }
    (async () => {
      setValidating(true);
      try {
        const { data: json, error } = await supabase.functions.invoke("validate-invite", {
          body: { token: inviteToken },
        });
        if (error || !json?.ok) {
          setErrorMsg(json?.error || "Invalid invite");
          setValidating(false);
          return;
        }
        setInviteData(json.invite);
        if (json.invite?.invite_email) setEmail(json.invite.invite_email);
      } catch (err:any) {
        setErrorMsg(String(err));
      } finally {
        setValidating(false);
      }
    })();
  }, [inviteToken]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      
      // Handle specific error cases
      if (error) {
        // Check if error is about user already existing
        if (error.message?.includes("User already registered") || 
            error.message?.includes("already exists") ||
            error.message?.includes("already registered")) {
          setErrorMsg("An account with this email already exists. Please sign in instead. You can use the invite link to sign in and accept the invite.");
          setLoading(false);
          return;
        }
        throw error;
      }

      const user = (data as any)?.user ?? null;
      
      // Check if user exists but is unconfirmed (identities.length === 0)
      // This happens when email confirmation is required and user hasn't confirmed yet
      if (
        user &&
        Array.isArray((user as any).identities) &&
        (user as any).identities.length === 0
      ) {
        setErrorMsg("An account with this email already exists but is not confirmed. Please check your email to confirm your account, then sign in with the invite link to accept the invite.");
        setLoading(false);
        return;
      }
      
      // If your Supabase requires email confirmation, `user` may be null - handle this case:
      if (!user) {
        // inform user to confirm email, and only call accept-invite after confirmation flow.
        setErrorMsg("Sign-up created. Please confirm your email before the invite is accepted.");
        setLoading(false);
        return;
      }

      // call accept-invite server function with token and new user.id
      if (inviteToken) {
        const { data: acceptJson, error: acceptError } = await supabase.functions.invoke("accept-invite", {
          body: { token: inviteToken, userId: user.id },
        });
        if (acceptError || !acceptJson?.ok) {
          // show error but user account exists; support manual recovery.
          setErrorMsg(acceptJson?.error || "Failed to accept invite");
          setLoading(false);
          return;
        }
      }

      // all good - redirect
      navigate("/dashboard");
    } catch (err:any) {
      setErrorMsg(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  if (validating) return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Validating invite...</div>;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Create account</h2>

        {errorMsg && <div className="text-destructive mb-4">{errorMsg}</div>}

      <form onSubmit={handleSignUp} className="space-y-4">
        <label>
          <div className="text-sm text-muted-foreground">Email</div>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label>
          <div className="text-sm text-muted-foreground">Password</div>
          <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        <div>
          <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create account"}</Button>
        </div>
      </form>
      </div>
    </div>
  );
}
