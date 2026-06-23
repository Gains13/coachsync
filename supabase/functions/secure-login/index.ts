import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMP_LOCK_ATTEMPTS = 5;
const SUSPEND_ATTEMPTS = 8;
const LOCK_MINUTES = 5;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
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
        { error: "Server is missing required Supabase environment variables." },
        500,
      );
    }

    const body = await req.json().catch(() => null);

    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return jsonResponse(
        { error: "Please enter your email and password." },
        400,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const authClient = createClient(supabaseUrl, anonKey);

    const now = new Date();

    const { data: existingSecurity, error: securityFetchError } =
      await adminClient
        .from("login_security")
        .select("*")
        .eq("email", email)
        .maybeSingle();

    if (securityFetchError) {
      console.error("Security fetch error:", securityFetchError);
      return jsonResponse({ error: "Could not check account security." }, 500);
    }

    if (existingSecurity?.status === "suspended") {
      return jsonResponse(
        {
          error:
            "This account has been suspended because of too many incorrect login attempts. Please email your trainer to reactivate your account.",
          suspended: true,
        },
        403,
      );
    }

    if (existingSecurity?.locked_until) {
      const lockedUntil = new Date(existingSecurity.locked_until);

      if (lockedUntil > now) {
        const secondsLeft = Math.ceil(
          (lockedUntil.getTime() - now.getTime()) / 1000,
        );

        return jsonResponse(
          {
            error: `Too many incorrect password attempts. Please wait ${Math.ceil(
              secondsLeft / 60,
            )} minute(s) before trying again.`,
            locked: true,
            secondsLeft,
            lockedUntil: lockedUntil.toISOString(),
          },
          429,
        );
      }
    }

    const { data: signInData, error: signInError } =
      await authClient.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !signInData.session || !signInData.user) {
      const currentAttempts = existingSecurity?.failed_attempts ?? 0;
      const nextAttempts = currentAttempts + 1;

      const updates: Record<string, unknown> = {
        email,
        failed_attempts: nextAttempts,
        last_failed_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      let userMessage = "Incorrect email or password.";

      if (nextAttempts >= SUSPEND_ATTEMPTS) {
        updates.status = "suspended";
        updates.suspended_at = now.toISOString();
        updates.locked_until = null;

        userMessage =
          "This account has been suspended because of too many incorrect login attempts. Please email your trainer to reactivate your account.";
      } else if (nextAttempts >= TEMP_LOCK_ATTEMPTS) {
        const lockedUntil = addMinutes(now, LOCK_MINUTES);
        updates.locked_until = lockedUntil.toISOString();

        userMessage =
          "Too many incorrect password attempts. This account is locked for 5 minutes.";
      }

      if (existingSecurity) {
        const { error: updateError } = await adminClient
          .from("login_security")
          .update(updates)
          .eq("email", email);

        if (updateError) {
          console.error("Security update error:", updateError);
        }
      } else {
        const { error: insertError } = await adminClient
          .from("login_security")
          .insert(updates);

        if (insertError) {
          console.error("Security insert error:", insertError);
        }
      }

      return jsonResponse(
        {
          error: userMessage,
          failedAttempts: nextAttempts,
          locked: nextAttempts >= TEMP_LOCK_ATTEMPTS && nextAttempts < SUSPEND_ATTEMPTS,
          suspended: nextAttempts >= SUSPEND_ATTEMPTS,
        },
        nextAttempts >= SUSPEND_ATTEMPTS ? 403 : 401,
      );
    }

    const { error: resetError } = await adminClient
      .from("login_security")
      .upsert(
        {
          email,
          failed_attempts: 0,
          locked_until: null,
          status: "active",
          last_failed_at: null,
          suspended_at: null,
          updated_at: now.toISOString(),
        },
        { onConflict: "email" },
      );

    if (resetError) {
      console.error("Security reset error:", resetError);
    }

    return jsonResponse({
      user: signInData.user,
      session: signInData.session,
    });
  } catch (error) {
    console.error("Secure login error:", error);
    return jsonResponse({ error: "Unexpected login error." }, 500);
  }
});