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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, client_id")
        .eq("id", userId)
        .maybeSingle();

      if (profileError || !profile) {
        console.error(profileError);
        setStatusMessage("Login worked, but no profile was found for this user.");
        setIsLoading(false);
        return;
      }

      localStorage.setItem("coachsync-user-role", profile.role);
      localStorage.setItem("coachsync-display-name", profile.full_name || "");
      localStorage.setItem("coachsync-client-id", profile.client_id || "");

      if (profile.role === "trainer") {
        navigate("/trainer");
        return;
      }

      if (profile.role === "client") {
        navigate("/client");
        return;
      }

      setStatusMessage("Profile role is not recognized.");
      setIsLoading(false);
    } catch (err) {
      console.error("Unexpected login error:", err);
      setStatusMessage("Something went wrong while logging in.");
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-2">
        <div>
          <div className="mb-6 inline-flex rounded-full border border-sky-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
            CoachSync Training App
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Training plans, client progress, and workout check-ins in one place.
          </h1>

          <p className="mt-5 max-w-xl text-lg text-slate-500">
            Log in as a trainer to manage clients and programs, or as a client
            to view your plan and submit completed workouts.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <FeatureCard title="Plans" icon="📋" />
            <FeatureCard title="Progress" icon="📈" />
            <FeatureCard title="Check-ins" icon="✅" />
          </div>
        </div>

        <div className="rounded-[2rem] border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              Welcome Back
            </p>

            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Sign in
            </h2>

            <p className="mt-2 text-slate-500">
              Use the email and password connected to your CoachSync account.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
            />

            <Input
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Enter password"
              type="password"
            />

            <div className="-mt-2 flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-blue-700 transition hover:text-blue-800"
              >
                Forgot password?
              </Link>
            </div>

            {statusMessage && (
              <p className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium text-slate-700">
                {statusMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Trainer and client access are controlled by the user profile role.
          </p>
        </div>
      </section>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function FeatureCard({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
        {icon}
      </div>

      <p className="font-bold text-slate-900">{title}</p>
    </div>
  );
}