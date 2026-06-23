import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");

  async function sendResetEmail() {
    setMessage("");

    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail) {
      setMessage("Please enter your email address.");
      return;
    }

    setIsSending(true);

    const { error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error(error);
      setMessage("Could not send reset email: " + error.message);
      setIsSending(false);
      return;
    }

    setMessage(
      "If an account exists with that email, a password reset link has been sent."
    );

    setIsSending(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
          CoachSync
        </p>

        <h1 className="mt-3 text-3xl font-black text-slate-900">
          Forgot Password
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter the email address connected to your CoachSync account and we’ll
          send you a link to create a new password.
        </p>

        {message && (
          <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold leading-6 text-slate-700">
            {message}
          </div>
        )}

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Email Address
          </label>

          <input
            value={email}
            type="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <button
          type="button"
          onClick={sendResetEmail}
          disabled={isSending}
          className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Sending Reset Link..." : "Send Reset Link"}
        </button>

        <Link
          to="/"
          className="mt-4 block text-center text-sm font-bold text-blue-700 hover:text-blue-800"
        >
          Back to Sign In
        </Link>
      </section>
    </main>
  );
}