import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Invalid token", { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Get request so we know who to email
    const { data: request, error: fetchError } = await supabase
      .from("workspace_join_requests")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !request) {
      return new Response("Request not found", { status: 404 });
    }

    // 2) Update request status
    const { error: updateError } = await supabase
      .from("workspace_join_requests")
      .update({ status: "rejected" })
      .eq("token", token);

    if (updateError) throw updateError;

    // 3) Get user email
    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", request.user_id)
      .single();

    if (!profileFetchError && profile?.email) {
      await resend.emails.send({
        from: "VisionM <no-reply@visionm.com>",
        to: [profile.email],
        subject: "Workspace Access Request Rejected",
        html: `
          <h1>Request Rejected</h1>
          <p>Hi ${profile.name ?? ""},</p>
          <p>Your request to join the workspace for <strong>${request.company_name}</strong> was rejected by the admin.</p>
          <p>If you believe this is a mistake, please contact your workspace administrator.</p>
        `,
      });
    }

    // 4) Return JSON response (for Dashboard handler) or HTML (for direct browser access)
    const acceptHeader = req.headers.get("accept") || "";
    const isJsonRequest = acceptHeader.includes("application/json") || req.headers.get("content-type")?.includes("application/json");

    if (isJsonRequest) {
      // Return JSON for Dashboard handler
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Request rejected" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      // Return HTML for direct browser access (email links)
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Request Rejected</title>
            <style>
              body { font-family: system-ui; padding: 40px; text-align: center; }
              .error { color: #ef4444; font-size: 48px; }
            </style>
          </head>
          <body>
            <div class="error">×</div>
            <h1>Workspace Request Rejected</h1>
            <p>The user's request to join the workspace has been rejected and the user has been notified by email.</p>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    }
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};

serve(handler);
