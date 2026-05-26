import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ClientSettings() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please fill in both password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage("Password updated successfully.");
    setNewPassword("");
    setConfirmPassword("");

    setTimeout(() => {
      navigate("/client");
    }, 1500);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("coachsync-user-role");
    localStorage.removeItem("coachsync-client-id");
    navigate("/");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Client Settings
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  Account Settings
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Change your password and manage your account access.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/client"
                  className="rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25 sm:py-2"
                >
                  Dashboard
                </Link>

                <button
                  onClick={handleLogout}
                  className="rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25 sm:py-2"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 md:p-8">
            <div className="rounded-3xl border border-sky-100 bg-sky-50 p-5 sm:p-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Change Password
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use this page to replace your temporary password with a new
                password you can remember.
              </p>

              {successMessage && (
                <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="mt-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    New Password
                  </label>

                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="mt-2 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Confirm New Password
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="mt-2 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {saving ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}