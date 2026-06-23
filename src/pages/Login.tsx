import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setStatusMessage("Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    setStatusMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("secure-login", {
        body: {
          email: email.trim().toLowerCase(),
          password,
        },
      });

      if (error || data?.error) {
        console.error("Secure login error:", error || data?.error);

        setStatusMessage(
          data?.error || error?.message || "Could not log in."
        );

        setIsLoading(false);
        return;
      }

      if (!data?.session?.access_token || !data?.session?.refresh_token) {
        setStatusMessage("Login succeeded, but your session could not be created.");
        setIsLoading(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        console.error("Session error:", sessionError);
        setStatusMessage("Could not start your session. Please try again.");
        setIsLoading(false);
        return;
      }

      const userId = data?.user?.id;

      if (!userId) {
        setStatusMessage("Logged in, but could not verify your account.");
        setIsLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError || !profileData) {
        console.error("Profile error:", profileError);
        setStatusMessage("Logged in, but could not load your profile.");
        setIsLoading(false);
        return;
      }

      if (profileData.role === "trainer") {
        navigate("/trainer");
      } else {
        navigate("/client-dashboard");
      }
    } catch (err) {
      console.error("Unexpected login error:", err);
      setStatusMessage("Something went wrong while logging in.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8">
        <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
          <div className="hidden bg-gradient-to-br from-blue-700 to-sky-500 p-10 text-white md:flex md:flex-col md:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                CoachSync
              </h1>

              <p className="mt-4 max-w-md text-lg leading-8 text-blue-50">
                A simple training dashboard for coaches and clients to manage
                workouts, progress, messages, and programs.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
                Trainer + Client Portal
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-50">
                Log in to continue to your dashboard.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 md:p-10">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
                CoachSync
              </p>

              <h2 className="mt-3 text-3xl font-bold text-slate-900">
                Login
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your email and password to access your account.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </Link>
              </div>

              {statusMessage && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-800">
                  {statusMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Logging in..." : "Log In"}
              </button>
            </form>

            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Account Security
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                After too many incorrect password attempts, your account may be
                temporarily locked or suspended for protection.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}