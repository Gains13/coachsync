import { createClient } from "@supabase/supabase-js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appUrl = process.env.VITE_APP_URL;

    if (!supabaseUrl || !serviceRoleKey || !appUrl) {
      return response.status(500).json({
        error:
          "Missing server environment variables. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and VITE_APP_URL.",
      });
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return response.status(401).json({
        error: "Missing Authorization header.",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const serverSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await serverSupabase.auth.getUser(token);

    if (userError || !user) {
      return response.status(401).json({
        error: "Could not verify trainer session.",
      });
    }

    const { data: trainerProfile, error: trainerProfileError } =
      await serverSupabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

    if (trainerProfileError || !trainerProfile) {
      return response.status(403).json({
        error: "Trainer profile not found.",
      });
    }

    if (trainerProfile.role !== "trainer") {
      return response.status(403).json({
        error: "Only trainers can invite clients.",
      });
    }

    const email = String(request.body?.email || "").trim().toLowerCase();
    const fullName = String(request.body?.fullName || "").trim();
    const clientId = String(request.body?.clientId || "").trim().toLowerCase();

    if (!email) {
      return response.status(400).json({
        error: "Client email is required.",
      });
    }

    if (!fullName) {
      return response.status(400).json({
        error: "Client full name is required.",
      });
    }

    const { data: inviteData, error: inviteError } =
      await serverSupabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/client`,
        data: {
          full_name: fullName,
          role: "client",
          client_id: clientId,
        },
      });

    if (inviteError) {
      return response.status(400).json({
        error: inviteError.message,
      });
    }

    const invitedUserId = inviteData.user?.id;

    if (!invitedUserId) {
      return response.status(500).json({
        error: "Invite was sent, but Supabase did not return a user ID.",
      });
    }

    const { error: profileError } = await serverSupabase.from("profiles").upsert({
      id: invitedUserId,
      full_name: fullName,
      client_id: clientId,
      role: "client",
    });

    if (profileError) {
      return response.status(500).json({
        error:
          "Invite was sent, but profile creation failed: " +
          profileError.message,
      });
    }

    return response.status(200).json({
      success: true,
      userId: invitedUserId,
      message: `Invite sent to ${email}.`,
    });
  } catch (error) {
    return response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong sending the invite.",
    });
  }
}