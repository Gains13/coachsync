import { supabase } from "./supabaseClient";

export async function logoutUser() {
  await supabase.auth.signOut();

  localStorage.removeItem("coachsync-user-role");
  localStorage.removeItem("coachsync-client-id");
  localStorage.removeItem("coachsync-display-name");

  window.location.href = "/";
}