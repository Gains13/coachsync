import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const resetId = useMemo(() => {
    return searchParams.get("resetId") || "";
  }, [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpdatePassword() {
    setMessage("");

    if (!resetId) {
      setMessage("This reset link is invalid. Please ask your trainer for a new link.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.functions.invoke(
      "complete-client-password-reset",
      {
        body: {
          resetId,
          newPassword: password,
        },
      }
    );

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    if (data?.error) {
      setMessage(data.error);
      setSaving(false);
      return;
    }

    setMessage("Password updated successfully. Redirecting to login...");

    setPassword("");
    setConfirmPassword("");

    setTimeout(() => {
      navigate("/");
    }, 1500);

    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Create New Password
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Enter a new password for your CoachSync account.
        </p>

        {!resetId && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
            This reset link is missing its reset ID. Please ask your trainer for
            a new link.
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {message}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              New Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Confirm Password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="button"
            onClick={handleUpdatePassword}
            disabled={saving || !resetId}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}