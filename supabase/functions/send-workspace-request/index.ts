import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appUrl = Deno.env.get("APP_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  userId: string;
  companyName: string;
  adminEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, companyName, adminEmail }: RequestBody = await req.json();
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate request token
    const token = crypto.randomUUID();

    // Store request
    const { error: requestError } = await supabase
      .from("workspace_join_requests")
      .insert({
        user_id: userId,
        company_name: companyName,
        admin_email: adminEmail,
        token,
        status: "pending",
      });

    if (requestError) throw requestError;

    // Get user info
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", userId)
      .single();

    // Send email to admin
    const approveLink = `${appUrl}/functions/v1/approve-workspace-request?token=${token}`;
    const rejectLink = `${appUrl}/functions/v1/reject-workspace-request?token=${token}`;
    
    const { error: emailError } = await resend.emails.send({
      from: "VisionM <no-reply@visionm.com>",
      to: [adminEmail],
      subject: `Workspace Join Request - ${companyName}`,
      html: `
        <h1>New Workspace Join Request</h1>
        <p>${profile?.name} (${profile?.email}) has requested to join the workspace for ${companyName}.</p>
        <div style="margin: 20px 0;">
          <a href="${approveLink}" style="display: inline-block; padding: 12px 24px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px;">Approve</a>
          <a href="${rejectLink}" style="display: inline-block; padding: 12px 24px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 4px;">Reject</a>
        </div>
        <p>You can also copy these links:</p>
        <p>Approve: ${approveLink}</p>
        <p>Reject: ${rejectLink}</p>
      `,
    });

    if (emailError) throw emailError;

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
