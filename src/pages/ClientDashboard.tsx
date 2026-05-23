import { Link } from "react-router-dom";
import { clients } from "../data/clients";
import { logoutUser } from "../lib/authHelpers";

export default function ClientDashbord() {
  const clientId = localStorage.getItem("coachsync-client-id");
  const client = clients.find((person) => person.id === clientId);

  if (!client) {
    return (
      <main className="min-h-screen bg-sky-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Client not found</h1>

          <p className="mt-4 text-slate-600">
            Saved client ID: {clientId || "No client ID saved"}
          </p>

          <p className="mt-2 text-slate-500">
            This must match one of the IDs in src/data/clients.ts, like adam,
            suzanne, robert, or carol.
          </p>

          <Link
            to="/"
            className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to login
          </Link>
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
                  Welcome, {client.name}
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Your assigned training plan, progress, completed workouts, and
                  goals all in one place.
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
            <SummaryCard title="Current Week" value={`Week ${client.currentWeek}`} />
            <SummaryCard title="Plan Status" value="Active" />
            <SummaryCard title="Main Goal" value={client.goals.mainGoal} />
            <SummaryCard title="Client" value={client.name} />
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
            description="See your short-term and long-term training goals."
            icon="🎯"
          />

          <DashboardTile
            to="/client-past-workouts"
            title="Past Workouts"
            description="Look back at workouts completed before using the app."
            icon="🕓"
          />

          <DashboardTile
            to="/client-progress"
            title="Progress"
            description="Track your progress overview and improvement trends."
            icon="📈"
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

      <p className={`mt-2 text-sm ${highlight ? "text-blue-50" : "text-slate-500"}`}>
        {description}
      </p>

      <p className={`mt-5 text-sm font-semibold ${highlight ? "text-white" : "text-blue-600"}`}>
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