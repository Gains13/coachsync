import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { WorkoutLog } from "../types";

export default function WorkoutHistory() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  useEffect(() => {
    const storedLogs = localStorage.getItem("coachsync_logs");
    setLogs(storedLogs ? JSON.parse(storedLogs) : []);
  }, []);

  const totalLogs = logs.length;
  const latestWorkout = logs[0]?.workoutTitle || "None yet";
  const painReports = logs.filter((log) => log.painReported).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Trainer Tools
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  Workout History
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Review older logged workouts and client check-ins saved in the
                  app.
                </p>
              </div>

              <Link
                to="/trainer"
                className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
              >
                Back to Trainer
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
            <SummaryCard title="Logged Workouts" value={`${totalLogs}`} />
            <SummaryCard title="Latest Workout" value={latestWorkout} />
            <SummaryCard title="Pain Reports" value={`${painReports}`} />
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            title="No workouts logged yet"
            description="Complete a workout first. Older local workout logs will appear here."
          />
        ) : (
          <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Logged Sessions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  These are saved from local app logs.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-sky-100 text-sm text-slate-500">
                    <th className="py-3 pr-4 font-semibold">Date</th>
                    <th className="py-3 pr-4 font-semibold">Workout</th>
                    <th className="py-3 pr-4 font-semibold">Difficulty</th>
                    <th className="py-3 pr-4 font-semibold">Pain</th>
                    <th className="py-3 pr-4 font-semibold">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-sky-50 transition hover:bg-sky-50"
                    >
                      <td className="py-4 pr-4 text-sm text-slate-600">
                        {log.date}
                      </td>

                      <td className="py-4 pr-4 font-semibold text-slate-900">
                        {log.workoutTitle}
                      </td>

                      <td className="py-4 pr-4">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
                          {log.difficulty}/10
                        </span>
                      </td>

                      <td className="py-4 pr-4">
                        {log.painReported ? (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            Yes
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                            No
                          </span>
                        )}
                      </td>

                      <td className="py-4 pr-4 text-sm text-slate-600">
                        {log.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
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

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
        🕓
      </div>

      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-slate-500">{description}</p>
    </div>
  );
}