import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, clientId } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Create admin supabase client using service role key
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Send the invite email through Supabase Auth
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: "coachsync-rust.vercel.app", // ← update this URL
    data: {
      role: "client",
      client_id: clientId,
    },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ success: true, userId: data.user?.id });
}