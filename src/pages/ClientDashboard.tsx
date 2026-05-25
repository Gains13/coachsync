import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientData = {
  full_name: string;
  client_id: string;
};

type GoalData = {
  main_goal: string;
};

type WeekData = {
  week_number: number;
};

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientData | null>(null);
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      // Get logged in user from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/");
        return;
      }

      const userId = session.user.id;

      // Pull profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, client_id")
        .eq("id", userId)
        .single();

      if (!profileData) {
        navigate("/");
        return;
      }

      setClient(profileData);

      // Pull goals
      const { data: goalData } = await supabase
        .from("client_goals")
        .select("main_goal")
        .eq("client_user_id", userId)
        .single();

      if (goalData) setGoal(goalData);

      // Pull most recent active week
      const { data: weekData } = await supabase
        .from("client_plan_weeks")
        .select("week_number")
        .eq("client_user_id", userId)
        .order("week_number", { ascending: false })
        .limit(1)
        .single();

      if (weekData) setCurrentWeek(weekData.week_number);

      setLoading(false);
    }

    loadDashboard();
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sky-50">
        <p className="text-slate-500">Loading your dashboard...</p>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="min-h-screen bg-sky-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Client profile not found</h1>
          <p className="mt-4 text-slate-600">
            Your account exists but no profile has been set up yet. Contact
            your trainer.
          </p>
          <button
            onClick={handleLogout}
            className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Client Dashboard
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  Welcome, {client.full_name}
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Your assigned training plan, progress, completed workouts,
                  and goals all in one place.
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-4 md:p-8">
            <SummaryCard
              title="Current Week"
              value={currentWeek ? `Week ${currentWeek}` : "Not assigned"}
            />
            <SummaryCard title="Plan Status" value="Active" />
            <SummaryCard
              title="Main Goal"
              value={goal?.main_goal || "Not set"}
            />
            <SummaryCard title="Client" value={client.full_name} />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DashboardTile
            to="/client-plan"
            title="My Plan"
            description="View your current workout, upcoming sessions, and completed workouts."
            icon="📋"
            highlight
          />

          <DashboardTile
            to="/client-assessment"
            title="Assessment"
            description="Review your starting measurements and baseline results."
            icon="📊"
          />

          <DashboardTile
            to="/client-goals"
            title="Goals"
            description="See and update your short-term and long-term training goals."
            icon="🎯"
          />

          <DashboardTile
            to="/client-past-workouts"
            title="Past Workouts"
            description="Look back at workouts you have completed."
            icon="🕓"
          />

          <DashboardTile
            to="/client-progress"
            title="Progress"
            description="Track strength gains, progressive overload, and muscle growth."
            icon="📈"
          />

          <DashboardTile
            to="/client-messages"
            title="Messages"
            description="Send a message to your trainer and view replies."
            icon="💬"
          />
        </div>
      </section>
    </main>
  );
}

function DashboardTile({
  to,
  title,
  description,
  icon,
  highlight = false,
}: {
  to: string;
  title: string;
  description: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group block rounded-3xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
        highlight
          ? "border-blue-200 bg-blue-600 text-white"
          : "border-sky-100 bg-white text-slate-900 hover:border-blue-200"
      }`}
    >
      <div
        className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${
          highlight
            ? "bg-white/15 ring-1 ring-white/25"
            : "bg-sky-50 ring-1 ring-sky-100"
        }`}
      >
        {icon}
      </div>

      <h2 className="text-xl font-bold">{title}</h2>

      <p
        className={`mt-2 text-sm ${
          highlight ? "text-blue-50" : "text-slate-500"
        }`}
      >
        {description}
      </p>

      <p
        className={`mt-5 text-sm font-semibold ${
          highlight ? "text-white" : "text-blue-600"
        }`}
      >
        Open →
      </p>
    </Link>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h2 className="mt-2 line-clamp-2 text-xl font-bold text-slate-900">
        {value}
      </h2>
    </div>
  );
}