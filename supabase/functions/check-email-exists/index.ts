import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    let email: string;
    try {
      const body = await req.json();
      email = body?.email;
    } catch (parseError) {
      return new Response(
        JSON.stringify({ exists: false, error: "Invalid request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ exists: false, error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Use Admin API to check if user exists by email
    // This requires service role key and doesn't expose user data
    // Use pagination to handle large user bases efficiently
    const normalizedEmail = email.toLowerCase().trim();
    let emailExists = false;
    let page = 1;
    const perPage = 1000; // Max users per page
    
    while (!emailExists) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error("Error listing users:", error);
        return new Response(
          JSON.stringify({ exists: false, error: "Failed to check email" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if any user has this email (case-insensitive)
      emailExists = users.some(
        (user) => user.email?.toLowerCase() === normalizedEmail
      );

      // If we found the email or no more users, break
      if (emailExists || users.length < perPage) {
        break;
      }

      page++;
    }

    return new Response(
      JSON.stringify({ exists: emailExists }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in check-email-exists:", error);
    return new Response(
      JSON.stringify({ exists: false, error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

