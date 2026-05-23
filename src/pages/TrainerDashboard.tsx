import { Link } from "react-router-dom";
import { logoutUser } from "../lib/authHelpers";

type DashboardTileProps = {
  to: string;
  title: string;
  description: string;
  icon: string;
  highlight?: boolean;
};

export default function TrainerDashboard() {
  const displayName =
    localStorage.getItem("coachsync-display-name") || "Trainer";

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  CoachSync
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  Welcome, {displayName}
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Manage clients, create programs, assign templates, and review
                  submitted workouts.
                </p>
              </div>

              <button
                onClick={logoutUser}
                className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-4 md:p-8">
            <SummaryCard title="Role" value="Trainer" />
            <SummaryCard title="Client Tools" value="Active" />
            <SummaryCard title="Program System" value="Supabase" />
            <SummaryCard title="Templates" value="Enabled" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DashboardTile
            to="/clients"
            title="Client List"
            description="View clients, open client details, and manage assigned plans."
            icon="👥"
            highlight
          />

          <DashboardTile
            to="/create-client"
            title="Create Client"
            description="Create a client profile, assessment, goals, and profile link."
            icon="➕"
          />

          <DashboardTile
            to="/create-program"
            title="Create Program"
            description="Build a client-facing week directly inside the assigned plan system."
            icon="📋"
          />

          <DashboardTile
            to="/program"
            title="Template Library"
            description="Create reusable program templates and assign them to clients."
            icon="📚"
          />

          <DashboardTile
            to="/workout-tracker"
            title="Workout Tracker"
            description="Review submitted client workouts and completed exercise notes."
            icon="🏋️"
          />

          <DashboardTile
            to="/workout-history"
            title="Workout History"
            description="View older logged workout history and local check-in records."
            icon="🕓"
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
}: DashboardTileProps) {
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

      <h2 className="mt-2 break-words text-xl font-bold text-slate-900">
        {value}
      </h2>
    </div>
  );
}