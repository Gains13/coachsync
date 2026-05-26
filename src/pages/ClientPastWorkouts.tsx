import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type WorkoutSubmission = {
  id: string;
  client_user_id?: string;
  workout_title?: string | null;
  title?: string | null;
  notes?: string | null;
  workout_notes?: string | null;
  pain_reported?: boolean | null;
  pain?: boolean | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  date?: string | null;
};

export default function ClientPastWorkouts() {
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadPastWorkouts();
  }, []);

  async function loadPastWorkouts() {
    setIsLoading(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in to view past workouts.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("workout_submissions")
      .select("*")
      .eq("client_user_id", user.id);

    if (error) {
      setStatusMessage("Could not load past workouts: " + error.message);
      setIsLoading(false);
      return;
    }

    const sortedData = ((data || []) as WorkoutSubmission[]).sort((a, b) => {
      const dateA = getSubmissionDateValue(a);
      const dateB = getSubmissionDateValue(b);

      return dateB - dateA;
    });

    setSubmissions(sortedData);
    setIsLoading(false);
  }

  return (
    <PageShell
      title="Past Workouts"
      subtitle="Review workouts you have completed and check your training history."
    >
      {statusMessage && (
        <p className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium text-slate-700">
          {statusMessage}
        </p>
      )}

      {isLoading ? (
        <p className="rounded-2xl bg-sky-50 p-5 text-slate-600">
          Loading past workouts...
        </p>
      ) : submissions.length === 0 ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-6">
          <h2 className="text-lg font-bold text-slate-900">
            No completed workouts yet
          </h2>

          <p className="mt-2 text-slate-500">
            Once you complete workouts, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => {
            const workoutTitle =
              submission.workout_title ||
              submission.title ||
              "Completed Workout";

            const notes =
              submission.notes ||
              submission.workout_notes ||
              "No notes added";

            const painReported =
              submission.pain_reported === true || submission.pain === true;

            const submissionDate =
              submission.submitted_at ||
              submission.completed_at ||
              submission.date ||
              null;

            return (
              <Link
                key={submission.id}
                to={`/workout-history/${submission.id}`}
                className="block rounded-2xl border border-sky-100 bg-sky-50 p-5 transition hover:border-blue-200 hover:bg-white hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {workoutTitle}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(submissionDate)}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      painReported
                        ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    }`}
                  >
                    {painReported ? "Pain Reported" : "No Pain"}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-sky-100">
                  <p className="text-xs font-medium text-slate-500">Notes</p>
                  <p className="mt-1 break-words font-bold text-slate-900">
                    {notes}
                  </p>
                </div>

                <p className="mt-4 text-sm font-semibold text-blue-600">
                  View workout details →
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function getSubmissionDateValue(submission: WorkoutSubmission) {
  const dateValue =
    submission.submitted_at || submission.completed_at || submission.date;

  if (!dateValue) return 0;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return 0;

  return date.getTime();
}

function formatDate(value: string | null) {
  if (!value) return "Date not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              CoachSync
            </p>

            <h1 className="mt-2 text-3xl font-bold md:text-4xl">{title}</h1>

            <p className="mt-2 max-w-2xl text-slate-500">{subtitle}</p>
          </div>

          <Link
            to="/client"
            className="rounded-xl border border-sky-100 bg-white px-4 py-2 text-center text-sm font-semibold text-blue-600 shadow-sm hover:bg-sky-50"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          {children}
        </div>
      </section>
    </main>
  );
}