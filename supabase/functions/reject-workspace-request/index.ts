import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Invalid token", { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update request status
    const { error: updateError } = await supabase
      .from("workspace_join_requests")
      .update({ status: "rejected" })
      .eq("token", token);

    if (updateError) throw updateError;

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
          <p>The user's request to join the workspace has been rejected.</p>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};

serve(handler);
