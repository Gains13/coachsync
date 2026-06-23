import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: React.FormEvent) {
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
        navigate("/trainer-dashboard");
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
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl">
              C
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              Welcome back
            </h1>

            <p className="text-slate-500 mt-2">
              Log in to your CoachSync account.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </div>

            {statusMessage && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {statusMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Protected by CoachSync secure login.
          </div>
        </div>
      </div>
    </main>
  );
}