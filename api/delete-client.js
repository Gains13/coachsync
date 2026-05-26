import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        error:
          "Missing server environment variables. Check VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
      });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid trainer session" });
    }

    const { data: trainerProfile, error: trainerProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (trainerProfileError) {
      return res.status(400).json({ error: trainerProfileError.message });
    }

    if (trainerProfile?.role !== "trainer") {
      return res.status(403).json({ error: "Only trainers can delete clients" });
    }

    const { clientUserId } = req.body;

    if (!clientUserId) {
      return res.status(400).json({ error: "clientUserId is required" });
    }

    const { data: clientProfile, error: clientProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", clientUserId)
        .maybeSingle();

    if (clientProfileError) {
      return res.status(400).json({ error: clientProfileError.message });
    }

    if (!clientProfile) {
      return res.status(404).json({ error: "Client profile not found" });
    }

    if (clientProfile.role !== "client") {
      return res.status(400).json({
        error: "This user is not a client. Delete cancelled for safety.",
      });
    }

    const deleteSteps = [
      supabaseAdmin
        .from("messages")
        .delete()
        .or(
          `client_user_id.eq.${clientUserId},sender_user_id.eq.${clientUserId},receiver_user_id.eq.${clientUserId}`
        ),

      supabaseAdmin
        .from("workout_submissions")
        .delete()
        .eq("client_user_id", clientUserId),

      supabaseAdmin
        .from("client_plan_weeks")
        .delete()
        .eq("client_user_id", clientUserId),

      supabaseAdmin
        .from("client_goals")
        .delete()
        .eq("client_user_id", clientUserId),

      supabaseAdmin
        .from("client_assessments")
        .delete()
        .eq("client_user_id", clientUserId),
    ];

    for (const step of deleteSteps) {
      const { error } = await step;

      if (error) {
        return res.status(400).json({
          error: "Delete failed: " + error.message,
        });
      }
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", clientUserId);

    if (profileDeleteError) {
      return res.status(400).json({
        error: "Profile delete failed: " + profileDeleteError.message,
      });
    }

    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(clientUserId);

    if (authDeleteError) {
      return res.status(400).json({
        error:
          "Client app data was deleted, but Supabase Auth delete failed: " +
          authDeleteError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${clientProfile.full_name} was deleted from CoachSync and Supabase Auth.`,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Something went wrong while deleting the client.",
      details: String(error),
    });
  }
}