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
    <main className="min-h-screen bg-canvas px-4 py-10 text-ink">
      <section className="mx-auto max-w-md rounded-[18px] border border-line bg-white p-6 ">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
          CoachSync
        </p>

        <h1 className="mt-3 text-3xl font-bold text-ink">
          Forgot Password
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted">
          Enter the email address connected to your CoachSync account and we’ll
          send you a link to create a new password.
        </p>

        {message && (
          <div className="mt-5 rounded-2xl border border-line bg-canvas p-4 text-sm font-semibold leading-6 text-ink/80">
            {message}
          </div>
        )}

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-ink/80">
            Email Address
          </label>

          <input
            value={email}
            type="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-ink outline-none ring-0 placeholder:text-muted focus:border-accent/40 focus:ring-4 focus:ring-line"
          />
        </div>

        <button
          type="button"
          onClick={sendResetEmail}
          disabled={isSending}
          className="mt-5 w-full rounded-2xl bg-accent px-5 py-4 text-sm font-bold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Sending Reset Link..." : "Send Reset Link"}
        </button>

        <Link
          to="/"
          className="mt-4 block text-center text-sm font-bold text-accent hover:text-accent-dark"
        >
          Back to Sign In
        </Link>
      </section>
    </main>
  );
}