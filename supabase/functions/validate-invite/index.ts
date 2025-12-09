// supabase/functions/validate-invite/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ??
      (await req.json().then((b: any) => b?.token).catch(() => null));

    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "token required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    const { data: invite, error } = await supabase
      .from("company_invites")
      .select("id, company_id, email, token, status, expires_at")
      .eq("token", token)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
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

    const { data: company } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", invite.company_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        ok: true,
        invite: {
          id: invite.id,
          company_id: invite.company_id,
          company_name: company?.name ?? null,
          invite_email: invite.email,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
    );
  } catch (err: any) {
    console.error("validate-invite error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message ?? String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }
});