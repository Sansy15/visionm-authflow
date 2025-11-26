import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { multiParser } from "https://deno.land/x/multiparser@0.114.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) throw new Error("Unauthorized");

    // Parse multipart form data
    const form = await multiParser(req);
    if (!form) throw new Error("No form data");

    const companyId = form.fields.company;
    const projectId = form.fields.project;
    const version = form.fields.version || null;
    const files = form.files?.files || [];

    if (!Array.isArray(files)) {
      throw new Error("No files provided");
    }

    // Create dataset record
    const { data: dataset, error: datasetError } = await supabase
      .from("datasets")
      .insert({
        company_id: companyId,
        project_id: projectId,
        version,
        status: "processing",
        created_by: user.id,
      })
      .select()
      .single();

    if (datasetError) throw datasetError;

    // Upload files to storage and create records
    let totalSize = 0;
    let totalImages = 0;

    for (const file of files) {
      const fileName = file.filename || `file-${Date.now()}`;
      const filePath = `${companyId}/${projectId}/${dataset.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("datasets")
        .upload(filePath, file.content, {
          contentType: file.contentType,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      // Create file record
      await supabase.from("dataset_files").insert({
        dataset_id: dataset.id,
        filename: fileName,
        file_type: file.contentType || "application/octet-stream",
        file_size: file.content.length,
        storage_path: filePath,
      });

      totalSize += file.content.length;
      
      const ext = fileName.toLowerCase().split(".").pop();
      if (["jpg", "jpeg", "png"].includes(ext || "")) {
        totalImages++;
      }
    }

    // Update dataset with totals and mark as ready
    await supabase
      .from("datasets")
      .update({
        total_images: totalImages,
        size_bytes: totalSize,
        status: "ready",
      })
      .eq("id", dataset.id);

    return new Response(
      JSON.stringify({ datasetId: dataset.id }),
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
