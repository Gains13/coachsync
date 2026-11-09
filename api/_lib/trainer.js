import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

// Returns the trainer's user, or sends the error response and returns null.
export async function requireTrainer(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return null;
  }

  if (!supabaseAdmin) {
    res.status(500).json({
      error:
        "Missing server environment variables. Check VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
    });
    return null;
  }

  const token = (req.headers.authorization || "").replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ error: "Missing authorization header" });
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    res.status(401).json({ error: "Invalid trainer session" });
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    res.status(400).json({ error: profileError.message });
    return null;
  }

  if (profile?.role !== "trainer") {
    res.status(403).json({ error: "Only trainers can do this" });
    return null;
  }

  return user;
}
