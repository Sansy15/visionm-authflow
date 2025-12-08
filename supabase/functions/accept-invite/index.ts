// supabase/functions/accept-invite/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    const userId = body?.userId;

    if (!token || !userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "token and userId required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    const { data: invite, error: inviteErr } = await supabase
      .from("company_invites")
      .select("id, company_id, email, token, status, expires_at")
      .eq("token", token)
      .limit(1)
      .maybeSingle();

    if (inviteErr) throw inviteErr;
    if (!invite) {
      return new Response(
        JSON.stringify({ ok: false, error: "invite not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }
    if (invite.status === "accepted") {
      return new Response(
        JSON.stringify({ ok: false, error: "invite already accepted" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }
    if (invite.status === "revoked") {
      return new Response(
        JSON.stringify({ ok: false, error: "invite revoked" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ ok: false, error: "invite expired" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // Get user's email to verify it matches invite email
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    if (!userProfile) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "User profile not found",
        }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // Verify email matches invite email
    if (userProfile.email !== invite.email) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Email does not match invite",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // Set company_id and role='member' on user's profile
    // Users who accept invites are members, not admins
    const { error: profileUpdateErr } = await supabase
      .from("profiles")
      .update({
        company_id: invite.company_id,
        role: 'member',
      })
      .eq("id", userId);

    if (profileUpdateErr) {
      console.error("profile update error:", profileUpdateErr);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "failed to update profile with company",
          details: profileUpdateErr,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    const { error: inviteUpdateErr } = await supabase
      .from("company_invites")
      .update({
        status: "accepted",
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (inviteUpdateErr) {
      console.error("invite status update error:", inviteUpdateErr);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "failed to update invite status",
          details: inviteUpdateErr,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
    );
  } catch (err: any) {
    console.error("accept-invite error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message ?? String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }
});
