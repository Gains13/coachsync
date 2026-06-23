import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = Deno.env.get("APP_URL")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: trainerProfile, error: trainerProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (trainerProfileError || trainerProfile?.role !== "trainer") {
      return new Response(JSON.stringify({ error: "Only trainers can reset client passwords" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { clientEmail } = await req.json();

    if (!clientEmail) {
      return new Response(JSON.stringify({ error: "Missing client email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: clientProfile, error: clientProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role")
      .eq("email", clientEmail)
      .eq("role", "client")
      .single();

    if (clientProfileError || !clientProfile) {
      return new Response(JSON.stringify({ error: "Client profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: clientEmail,
      options: {
        redirectTo: `${appUrl}/reset-password`,
      },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        resetLink: data.properties?.action_link,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});