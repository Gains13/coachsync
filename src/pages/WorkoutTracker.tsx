import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type WorkoutSubmission = {
  id: string;
  client_user_id: string;
  workout_title: string;
  submitted_at: string;
  notes: string | null;
};

export default function WorkoutTracker() {
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    setIsLoading(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from("workout_submissions")
      .select("id, client_user_id, workout_title, submitted_at, notes")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatusMessage("Could not load workout submissions: " + error.message);
      setIsLoading(false);
      return;
    }

    setSubmissions(data || []);
    setIsLoading(false);
  }

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
                  Workout Tracker
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Review submitted client workouts and open completed workout
                  details.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={loadSubmissions}
                  className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
                >
                  Refresh
                </button>

                <Link
                  to="/trainer"
                  className="rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
            <SummaryCard title="Submissions" value={`${submissions.length}`} />
            <SummaryCard
              title="Latest"
              value={submissions[0]?.workout_title || "None yet"}
            />
            <SummaryCard title="Source" value="Supabase" />
          </div>
        </div>

        {statusMessage && (
          <p className="mb-6 rounded-2xl border border-sky-100 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
            {statusMessage}
          </p>
        )}

        {isLoading ? (
          <EmptyState
            title="Loading submissions..."
            description="Checking Supabase for completed workout submissions."
          />
        ) : submissions.length === 0 ? (
          <EmptyState
            title="No workout submissions yet"
            description="Client submissions will appear here after they complete workouts."
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {submissions.map((submission) => (
              <Link
                key={submission.id}
                to={`/workout-history/${submission.id}`}
                className="group block rounded-3xl border border-sky-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
                      🏋️
                    </div>

                    <h2 className="text-xl font-bold text-slate-900">
                      {submission.workout_title}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Submitted:{" "}
                      {new Date(submission.submitted_at).toLocaleString()}
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    Submitted
                  </span>
                </div>

                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-sm font-medium text-slate-500">
                    Client User ID
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                    {submission.client_user_id}
                  </p>
                </div>

                <p className="mt-4 text-sm font-semibold text-blue-600">
                  View workout →
                </p>
              </Link>
            ))}
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
        📈
      </div>

      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-slate-500">{description}</p>
    </div>
  );
}