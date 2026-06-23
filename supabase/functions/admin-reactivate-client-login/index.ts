import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        { error: "Missing required Supabase environment variables." },
        500
      );
    }

    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "You must be logged in." }, 401);
    }

    const { data: trainerProfile, error: trainerProfileError } =
      await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (trainerProfileError || !trainerProfile) {
      return jsonResponse(
        { error: "Could not verify trainer account." },
        403
      );
    }

    if (trainerProfile.role !== "trainer") {
      return jsonResponse(
        { error: "Only trainers can reactivate client accounts." },
        403
      );
    }

    const body = await req.json().catch(() => null);

    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return jsonResponse({ error: "Client email is required." }, 400);
    }

    const { error: updateError } = await adminClient
      .from("login_security")
      .upsert(
        {
          email,
          failed_attempts: 0,
          locked_until: null,
          status: "active",
          last_failed_at: null,
          suspended_at: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "email",
        }
      );

    if (updateError) {
      console.error("Reactivate login error:", updateError);
      return jsonResponse(
        { error: "Could not reactivate this client login." },
        500
      );
    }

    return jsonResponse({
      success: true,
      message: "Client login has been reactivated.",
      email,
    });
  } catch (error) {
    console.error("Unexpected reactivation error:", error);

    return jsonResponse(
      { error: "Unexpected error while reactivating client login." },
      500
    );
  }
});