// supabase/functions/create-invite/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL")!; // e.g. http://localhost:8080 or your deployed app
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const INVITE_FROM = Deno.env.get("INVITE_FROM") || "VisionM <no-reply@your-verified-domain.com>";

// Normalize APP_URL to remove trailing slashes
const normalizedAppUrl = APP_URL.replace(/\/+$/, '');

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  companyId: string;
  inviteEmail: string;
  inviteName?: string;
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    const body: Body = await req.json().catch(() => ({} as Body));
    const { companyId, inviteEmail, inviteName } = body ?? {};

    if (!companyId || !inviteEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "companyId and inviteEmail are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // ---- Auth: get inviter from access token ----
    const authHeader = req.headers.get("authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authorization bearer token required",
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      console.error("auth.getUser error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid auth token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    const inviterId = user.id;

    // ---- Company lookup ----
    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    if (compErr) {
      console.error("company lookup error:", compErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to load company: ${
            compErr.message ?? String(compErr)
          }`,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    if (!company) {
      return new Response(
        JSON.stringify({ success: false, error: "Company not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // ---- Permission check: Verify inviter is admin of the SPECIFIC company (companyId) ----
    // Admin is determined ONLY by: inviter created the company (created_by === inviterId)
    // Email match check has been removed - only company creator can invite users
    
    let isAdmin = false;

    // Check: User created the company (check created_by field)
    if (company.created_by && company.created_by === inviterId) {
      isAdmin = true;
    }

    // If inviter did not create the company, reject and don't send email
    if (!isAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Insufficient permissions: must be company admin",
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // ---- Check if invitee email already exists in this company ----
    const { data: existingMember } = await supabase
      .from("profiles")
      .select("id, email, company_id")
      .eq("email", inviteEmail)
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingMember) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "User already a member",
          errorCode: "USER_ALREADY_MEMBER",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // ---- Create invite row in company_invites ----
    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: inserted, error: insertErr } = await supabase
      .from("company_invites")
      .insert([
        {
          company_id: companyId,
          email: inviteEmail,
          token,
          created_by: inviterId,
          expires_at: expiresAt,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (insertErr) {
      console.error("insert invite error:", insertErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create invite" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // Frontend invite link (same one you copy in the UI)
    const inviteLink = `${normalizedAppUrl}/auth?invite=${encodeURIComponent(token)}`;

    // ---- Check if user exists in Supabase Auth ----
    let existingUser = null;
    try {
      // Use listUsers and filter by email (getUserByEmail might not be available in all versions)
      const { data: usersData, error: userError } = await supabase.auth.admin.listUsers();
      if (!userError && usersData?.users) {
        existingUser = usersData.users.find((u: any) => u.email === inviteEmail) || null;
      }
    } catch (err) {
      // User doesn't exist or error checking - will create new user
      console.log("User check error:", err);
    }

    let authUserId: string | null = null;

    // ---- Path A: User doesn't exist - Create account first, then send magic link ----
    if (!existingUser) {
      // Step 1: Create user account
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: inviteEmail,
        email_confirm: false, // User will confirm via magic link
        user_metadata: {
          company_id: companyId,
          company_name: company.name ?? null,
          invite_token: token,
        },
      });

      if (createError) {
        console.error("admin.createUser error:", createError);
        await supabase
          .from("company_invites")
          .update({
            status: "email_failed",
            error_message: createError.message ?? String(createError),
          })
          .eq("id", inserted.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create user account",
            details: createError.message ?? String(createError),
            inviteLink,
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
        );
      }

      authUserId = newUser?.user?.id ?? null;

      // Step 2: Generate magic link (without sending email)
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: inviteEmail,
        options: {
          redirectTo: inviteLink,
        },
      });

      if (linkError || !linkData?.properties?.action_link) {
        console.error("generateLink error (new user):", linkError);
        await supabase
          .from("company_invites")
          .update({
            status: "email_failed",
            error_message: linkError?.message ?? "Failed to generate magic link",
          })
          .eq("id", inserted.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to generate magic link",
            details: linkError?.message ?? String(linkError),
            inviteLink,
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
        );
      }

      const magicLink = linkData.properties.action_link;

      // Step 3: Send custom email via Resend
      if (resend) {
        try {
          console.log("Sending custom email via Resend to:", inviteEmail);
          const emailResult = await resend.emails.send({
            from: INVITE_FROM,
            to: [inviteEmail],
            subject: `You've been invited to join ${company.name ?? "a workspace"} on VisionM`,
            html: `
              <h2>You've been invited!</h2>
              <p>Hello${inviteName ? ` ${inviteName}` : ""},</p>
              <p>You have been invited to join <strong>${company.name ?? "a workspace"}</strong> on VisionM.</p>
              <p>Click the link below to sign in and accept the invitation:</p>
              <p style="margin:18px 0;">
                <a href="${magicLink}" style="display:inline-block;padding:12px 24px;background-color:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;">Sign In & Accept Invitation</a>
              </p>
              <p>If the button does not work, copy and paste this link into your browser:</p>
              <p style="word-break:break-all;">${magicLink}</p>
              <hr/>
              <small>This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}.</small>
            `,
          });
          // Check if Resend actually succeeded
          if (emailResult.error) {
            console.error("Resend email failed:", emailResult.error);
            throw new Error(emailResult.error.message || "Resend API error");
          }
          console.log("Resend email sent successfully:", emailResult.data);
        } catch (emailError) {
          console.error("Resend email error (new user):", emailError);
          // Don't fail - fall back to Supabase email
          console.log("Falling back to Supabase email due to Resend error");
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: inviteEmail,
            options: {
              emailRedirectTo: inviteLink,
              data: {
                company_id: companyId,
                company_name: company.name ?? null,
                invite_token: token,
              },
            },
          });
          if (otpError) {
            console.error("Fallback signInWithOtp also failed:", otpError);
            await supabase
              .from("company_invites")
              .update({
                status: "email_failed",
                error_message: `Resend failed: ${emailError?.message}, Supabase fallback also failed: ${otpError.message}`,
              })
              .eq("id", inserted.id);
            return new Response(
              JSON.stringify({
                success: false,
                error: "Failed to send email",
                details: emailError?.message ?? String(emailError),
                inviteLink,
              }),
              { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }
        }
      } else {
        // Fallback: Use Supabase's built-in email if Resend is not configured
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: inviteEmail,
          options: {
            emailRedirectTo: inviteLink,
            data: {
              company_id: companyId,
              company_name: company.name ?? null,
              invite_token: token,
            },
          },
        });

        if (otpError) {
          console.error("signInWithOtp error (new user, fallback):", otpError);
          await supabase
            .from("company_invites")
            .update({
              status: "email_failed",
              error_message: otpError.message ?? String(otpError),
            })
            .eq("id", inserted.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: "Failed to send magic link email",
              details: otpError.message ?? String(otpError),
              inviteLink,
            }),
            { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      }
    } else {
      // ---- Path B: User exists - Generate magic link and send custom email ----
      authUserId = existingUser.id;

      // Generate magic link (without sending email)
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: inviteEmail,
        options: {
          redirectTo: inviteLink,
        },
      });

      if (linkError || !linkData?.properties?.action_link) {
        console.error("generateLink error (existing user):", linkError);
        await supabase
          .from("company_invites")
          .update({
            status: "email_failed",
            error_message: linkError?.message ?? "Failed to generate magic link",
          })
          .eq("id", inserted.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to generate magic link",
            details: linkError?.message ?? String(linkError),
            inviteLink,
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
        );
      }

      const magicLink = linkData.properties.action_link;

      // Send custom email via Resend
      if (resend) {
        try {
          console.log("Sending custom email via Resend to:", inviteEmail);
          const emailResult = await resend.emails.send({
            from: INVITE_FROM,
            to: [inviteEmail],
            subject: `You've been invited to join ${company.name ?? "a workspace"} on VisionM`,
            html: `
              <h2>You've been invited!</h2>
              <p>Hello${inviteName ? ` ${inviteName}` : ""},</p>
              <p>You have been invited to join <strong>${company.name ?? "a workspace"}</strong> on VisionM.</p>
              <p>Click the link below to sign in and accept the invitation:</p>
              <p style="margin:18px 0;">
                <a href="${magicLink}" style="display:inline-block;padding:12px 24px;background-color:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;">Sign In & Accept Invitation</a>
              </p>
              <p>If the button does not work, copy and paste this link into your browser:</p>
              <p style="word-break:break-all;">${magicLink}</p>
              <hr/>
              <small>This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}.</small>
            `,
          });
          // Check if Resend actually succeeded
          if (emailResult.error) {
            console.error("Resend email failed:", emailResult.error);
            throw new Error(emailResult.error.message || "Resend API error");
          }
          console.log("Resend email sent successfully:", emailResult.data);
        } catch (emailError) {
          console.error("Resend email error (existing user):", emailError);
          // Don't fail - fall back to Supabase email
          console.log("Falling back to Supabase email due to Resend error");
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: inviteEmail,
            options: {
              emailRedirectTo: inviteLink,
              data: {
                company_id: companyId,
                company_name: company.name ?? null,
                invite_token: token,
              },
            },
          });
          if (otpError) {
            console.error("Fallback signInWithOtp also failed:", otpError);
            await supabase
              .from("company_invites")
              .update({
                status: "email_failed",
                error_message: `Resend failed: ${emailError?.message}, Supabase fallback also failed: ${otpError.message}`,
              })
              .eq("id", inserted.id);
            return new Response(
              JSON.stringify({
                success: false,
                error: "Failed to send email",
                details: emailError?.message ?? String(emailError),
                inviteLink,
              }),
              { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }
        }
      } else {
        // Fallback: Use Supabase's built-in email if Resend is not configured
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: inviteEmail,
          options: {
            emailRedirectTo: inviteLink,
            data: {
              company_id: companyId,
              company_name: company.name ?? null,
              invite_token: token,
            },
          },
        });

        if (otpError) {
          console.error("signInWithOtp error (existing user, fallback):", otpError);
          await supabase
            .from("company_invites")
            .update({
              status: "email_failed",
              error_message: otpError.message ?? String(otpError),
            })
            .eq("id", inserted.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: "Failed to send magic link email",
              details: otpError.message ?? String(otpError),
              inviteLink,
            }),
            { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      }
    }

    // Mark email sent + store auth user id
    await supabase
      .from("company_invites")
      .update({
        status: "email_sent",
        auth_user_id: authUserId,
      })
      .eq("id", inserted.id);

    return new Response(
      JSON.stringify({
        success: true,
        inviteId: inserted.id,
        inviteLink,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
    );
  } catch (err: any) {
    console.error("Unhandled create-invite error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message ?? String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }
});