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

    // Get request
    const { data: request, error: fetchError } = await supabase
      .from("workspace_join_requests")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !request) {
      return new Response("Request not found", { status: 404 });
    }

    // Update request status
    const { error: updateError } = await supabase
      .from("workspace_join_requests")
      .update({ status: "approved" })
      .eq("token", token);

    if (updateError) throw updateError;

    // Find or create company
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("name", request.company_name)
      .eq("admin_email", request.admin_email)
      .single();

    let companyId = existingCompany?.id;

    if (!companyId) {
      // Create company
      const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: request.company_name,
          admin_email: request.admin_email,
          created_by: request.user_id,
        })
        .select()
        .single();

      if (companyError) throw companyError;
      companyId = newCompany.id;
    }

    // Update user profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ company_id: companyId })
      .eq("id", request.user_id);

    if (profileError) throw profileError;

    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Request Approved</title>
          <style>
            body { font-family: system-ui; padding: 40px; text-align: center; }
            .success { color: #22c55e; font-size: 48px; }
          </style>
        </head>
        <body>
          <div class="success">✓</div>
          <h1>Workspace Request Approved</h1>
          <p>The user has been added to the workspace.</p>
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
