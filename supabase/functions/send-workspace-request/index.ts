// functions/send_workspace_request/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Normalize APP_URL to remove trailing slashes
const appUrl = Deno.env.get("APP_URL")!.replace(/\/+$/, '');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

interface RequestBody {
  userId: string;
  companyName: string;
  adminEmail: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: RequestBody = await req.json();

    if (!body?.userId || !body?.companyName || !body?.adminEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing userId/companyName/adminEmail in request body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { userId, companyName, adminEmail } = body;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 0) fetch profile for requester email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name,email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return new Response(JSON.stringify({ success: false, error: "Failed to load requester profile" }), { status: 500, headers: corsHeaders });
    }

    const requesterEmail = profile?.email ?? null;
    const requesterName = profile?.name ?? "A user";

    if (!requesterEmail) {
      // If profile email is missing, fail early so DB doesn't get incomplete data
      return new Response(JSON.stringify({ success: false, error: "Requester email not available in profiles" }), { status: 400, headers: corsHeaders });
    }

    // 1) Create join request row
    const token = crypto.randomUUID();
    const insertPayload = {
      user_id: userId,
      admin_email: adminEmail,
      company_name: companyName,
      token,
      status: "pending",
    };

    const { data: insertData, error: insertError } = await supabase
      .from("workspace_join_requests")
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      console.error("Insert request error:", insertError);
      return new Response(JSON.stringify({ success: false, error: "Failed to create request" }), { status: 500, headers: corsHeaders });
    }

    const requestId = insertData.id;

    // 2) Prepare links and email content
    // Use frontend URLs that admins will open (Dashboard handles the approve/reject actions)
    const approveLink = `${appUrl}/dashboard?token=${token}&action=approve`;
    const rejectLink = `${appUrl}/dashboard?token=${token}&action=reject`;

    // 3) Send email via Resend
    let emailSent = false;
    try {
      await resend.emails.send({
        from: "VisionM <no-reply@your-verified-domain.com>", // must be verified on Resend
        to: [adminEmail],
        subject: `Workspace Join Request — ${companyName}`,
        html: `
          <h2>Workspace Join Request</h2>
          <p><strong>${requesterName}</strong> (${requesterEmail}) has requested to join <b>${companyName}</b>.</p>
          <div style="margin:18px 0;">
            <a href="${approveLink}" style="padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px;">Approve</a>
            <a href="${rejectLink}" style="padding:10px 16px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;">Reject</a>
          </div>
          <p>If the buttons do not work, copy/paste the following link to your browser:</p>
          <p>Approve: ${approveLink}</p>
          <p>Reject: ${rejectLink}</p>
        `,
      });

      emailSent = true;

      // update row status to email_sent
      await supabase
        .from("workspace_join_requests")
        .update({ status: "email_sent" })
        .eq("id", requestId);
    } catch (sendErr) {
      console.error("Resend error:", sendErr);
      // update DB to show email failed (so you can retry)
      await supabase
        .from("workspace_join_requests")
        .update({ status: "email_failed", error_message: String(sendErr) })
        .eq("id", requestId);
    }

    return new Response(JSON.stringify({ success: true, emailSent }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("Unhandled error in send_workspace_request:", err);
    return new Response(JSON.stringify({ success: false, error: err.message ?? "Unknown error" }), { status: 500, headers: corsHeaders });
  }
});
