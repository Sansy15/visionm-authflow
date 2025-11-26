import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appUrl = Deno.env.get("APP_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  projectId: string;
  userEmail: string;
  projectPassword: string;
  invitedBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, userEmail, projectPassword, invitedBy }: RequestBody = await req.json();
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Hash password
    const hashedPassword = await bcrypt.hash(projectPassword);

    // Store project user
    const { error: insertError } = await supabase
      .from("project_users")
      .insert({
        project_id: projectId,
        user_email: userEmail,
        hashed_password: hashedPassword,
        invited_by: invitedBy,
      });

    if (insertError) throw insertError;

    // Get project and company info
    const { data: project } = await supabase
      .from("projects")
      .select("name, companies(name)")
      .eq("id", projectId)
      .single();

    // Send email
    const projectLink = `${appUrl}/dataset/${projectId}`;
    
    const { error: emailError } = await resend.emails.send({
      from: "VisionM <no-reply@visionm.com>",
      to: [userEmail],
      subject: `You've been invited to ${project?.name}`,
      html: `
        <h1>Project Invitation</h1>
        <p>You've been invited to access the project "${project?.name}".</p>
        <p>To access the project, you'll need to use the project password that was shared with you separately.</p>
        <div style="margin: 20px 0;">
          <a href="${projectLink}" style="display: inline-block; padding: 12px 24px; background-color: #0088cc; color: white; text-decoration: none; border-radius: 4px;">Access Project</a>
        </div>
        <p>Or copy this link into your browser:</p>
        <p>${projectLink}</p>
        <p><strong>Important:</strong> Keep your project password secure and don't share it with unauthorized users.</p>
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
