import { createClient } from "@supabase/supabase-js";

function createTemporaryPassword() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36).slice(-4);
  return `CoachSync-${randomPart}-${timePart}!`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return response.status(500).json({
        error:
          "Missing server environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
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
        error: "Only trainers can create clients.",
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

    if (!clientId) {
      return response.status(400).json({
        error: "Client ID is required.",
      });
    }

    const temporaryPassword = createTemporaryPassword();

    const { data: createdUserData, error: createUserError } =
      await serverSupabase.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "client",
          client_id: clientId,
          must_change_password: true,
        },
      });

    if (createUserError) {
      return response.status(400).json({
        error: createUserError.message,
      });
    }

    const createdUserId = createdUserData.user?.id;

    if (!createdUserId) {
      return response.status(500).json({
        error: "Client account was created, but Supabase did not return a user ID.",
      });
    }

    const { error: profileError } = await serverSupabase.from("profiles").upsert({
      id: createdUserId,
      full_name: fullName,
      client_id: clientId,
      role: "client",
    });

    if (profileError) {
      return response.status(500).json({
        error:
          "Client account was created, but profile creation failed: " +
          profileError.message,
      });
    }

    return response.status(200).json({
      success: true,
      userId: createdUserId,
      temporaryPassword,
      message: `Client account created for ${email}.`,
    });
  } catch (error) {
    return response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong creating the client account.",
    });
  }
}