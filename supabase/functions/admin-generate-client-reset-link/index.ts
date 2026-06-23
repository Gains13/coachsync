import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = Deno.env.get("APP_URL");
    const normalizedAppUrl = appUrl?.startsWith("http")
  ? appUrl.replace(/\/$/, "")
  : `https://${appUrl?.replace(/\/$/, "")}`;

    if (!supabaseUrl || !serviceRoleKey || !appUrl) {
      return new Response(
        JSON.stringify({
          error:
            "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or APP_URL environment variable",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
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
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const { data: trainerProfile, error: trainerProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

    if (trainerProfileError || trainerProfile?.role !== "trainer") {
      return new Response(
        JSON.stringify({
          error: "Only trainers can generate password reset links",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();
    const clientUserId = body.clientUserId;

    if (!clientUserId) {
      return new Response(JSON.stringify({ error: "Missing client user ID" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const { data: clientProfile, error: clientProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", clientUserId)
        .eq("role", "client")
        .single();

    if (clientProfileError || !clientProfile) {
      return new Response(JSON.stringify({ error: "Client profile not found" }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const {
      data: { user: clientAuthUser },
      error: clientAuthError,
    } = await supabaseAdmin.auth.admin.getUserById(clientUserId);

    if (clientAuthError || !clientAuthUser?.email) {
      return new Response(
        JSON.stringify({
          error: "Could not find client auth email",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: clientAuthUser.email,
      options: {
        redirectTo: `${normalizedAppUrl}/reset-password`,
      },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        clientName: clientProfile.full_name,
        clientEmail: clientAuthUser.email,
        resetLink: data.properties?.action_link,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});