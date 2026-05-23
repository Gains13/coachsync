import { Link, useParams } from "react-router-dom";
import { clients } from "../data/clients";

export default function ClientProfile() {
  const { clientId } = useParams();
  const client = clients.find((person) => person.id === clientId);

  if (!client) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-2xl font-bold">Client not found</h1>
        <Link to="/clients" className="mt-4 inline-block text-blue-400">
          Back to Client List
        </Link>
      </main>
    );
  }

  const unlockedWeeks = client.planWeeks.filter(
    (week) => week.status !== "locked"
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              Client Profile
            </p>
            <h1 className="mt-2 text-3xl font-bold">{client.name}</h1>
            <p className="mt-2 text-slate-400">{client.planName}</p>
          </div>

          <Link
            to="/clients"
            className="rounded-xl border border-slate-700 px-4 py-2 text-center text-sm font-semibold hover:bg-slate-800"
          >
            Back to Clients
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <StatCard title="Current Week" value={`Week ${client.currentWeek}`} />
          <StatCard title="Unlocked Weeks" value={`${unlockedWeeks}`} />
          <StatCard title="Past Workouts" value={`${client.pastWorkouts.length}`} />
          <StatCard title="Status" value="Active" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <SectionCard title="Initial Assessment">
            <div className="grid gap-3 md:grid-cols-2">
              <InfoRow label="Starting Weight" value={client.assessment.startingWeight} />
              <InfoRow label="Body Fat" value={client.assessment.bodyFat} />
              <InfoRow label="Muscle Mass" value={client.assessment.muscleMass} />
              <InfoRow label="Waist" value={client.assessment.waist} />
              <InfoRow label="Hips" value={client.assessment.hips} />
              <InfoRow label="Chest" value={client.assessment.chest} />
            </div>

            <p className="mt-4 rounded-xl bg-slate-800 p-4 text-sm text-slate-300">
              {client.assessment.notes}
            </p>
          </SectionCard>

          <SectionCard title="Goals">
            <div className="space-y-3">
              <InfoRow label="Main Goal" value={client.goals.mainGoal} />
              <InfoRow label="Short-Term Goal" value={client.goals.shortTerm} />
              <InfoRow label="Long-Term Goal" value={client.goals.longTerm} />
            </div>
          </SectionCard>
        </div>

        <div className="mt-8">
          <SectionCard title="Assigned Plan">
            <div className="grid gap-4 md:grid-cols-2">
              {client.planWeeks.map((week) => (
                <div
                  key={week.weekNumber}
                  className="rounded-xl bg-slate-800 p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Week {week.weekNumber}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        week.status === "locked"
                          ? "bg-red-500/20 text-red-300"
                          : week.status === "completed"
                          ? "bg-green-500/20 text-green-300"
                          : "bg-blue-500/20 text-blue-300"
                      }`}
                    >
                      {week.status}
                    </span>
                  </div>

                  {week.status === "locked" ? (
                    <p className="text-sm text-slate-400">
                      Locked until you add or unlock this week.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {week.workouts.map((workout) => (
                        <div key={workout.title} className="rounded-lg bg-slate-900 p-4">
                          <h4 className="font-semibold">{workout.title}</h4>

                          <div className="mt-3 space-y-3">
                            {workout.exercises.map((exercise) => (
                              <div key={exercise.name} className="rounded-lg bg-slate-800 p-3">
                                <p className="font-medium">{exercise.name}</p>
                                <p className="text-sm text-slate-400">
                                  {exercise.sets} sets x {exercise.reps} • Rest: {exercise.rest}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="mt-8">
          <SectionCard title="Past Workouts Before App">
            <div className="space-y-3">
              {client.pastWorkouts.map((workout) => (
                <p key={workout} className="rounded-xl bg-slate-800 p-4">
                  {workout}
                </p>
              ))}
            </div>
          </SectionCard>
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{title}</p>
      <h2 className="mt-2 text-2xl font-bold">{value}</h2>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}