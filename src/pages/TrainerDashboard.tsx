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
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  CoachSync Trainer Dashboard
                </p>

                <h1 className="mt-3 break-words text-3xl font-bold md:text-4xl">
                  Welcome, {displayName}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Manage clients, create programs, assign training plans, review
                  completed workouts, and communicate with clients from one
                  place.
                </p>
              </div>

              <button
                onClick={logoutUser}
                className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-4 md:p-8">
            <SummaryCard title="Role" value="Trainer" />
            <SummaryCard title="Client System" value="Active" />
            <SummaryCard title="Program Builder" value="Ready" />
            <SummaryCard title="Workout Logs" value="Enabled" />
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Quick Actions
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Start by creating a client, building their program, then tracking
            their completed workouts and progress.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DashboardTile
            to="/clients"
            title="Client List"
            description="View all clients, open client details, and manage assigned plans."
            icon="👥"
            highlight
          />

          <DashboardTile
            to="/create-client"
            title="Create Client"
            description="Create a client login, add their starting info, and set their goals."
            icon="➕"
          />

          <DashboardTile
            to="/create-program"
            title="Create Program"
            description="Build a client-facing training week and assign workouts."
            icon="📋"
          />

          <DashboardTile
            to="/program"
            title="Template Library"
            description="Create reusable program templates for future clients."
            icon="📚"
          />

          <DashboardTile
            to="/messages"
            title="Messages"
            description="Read client messages and keep communication organized."
            icon="💬"
          />

          <DashboardTile
            to="/workout-tracker"
            title="Workout Tracker"
            description="Review submitted client workouts, notes, sets, reps, and progress."
            icon="🏋️"
          />

          <DashboardTile
            to="/workout-history"
            title="Workout History"
            description="View older logged workouts and completed training records."
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
        className={`mt-2 text-sm leading-6 ${
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
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{title}</p>

      <h2 className="mt-2 break-words text-lg font-bold text-slate-900 sm:text-xl">
        {value}
      </h2>
    </div>
  );
}