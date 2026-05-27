import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

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
  const [unreadMessages, setUnreadMessages] = useState(0);
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

    const { count: unreadCount, error: unreadError } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_user_id", user.id)
      .eq("receiver_user_id", user.id)
      .is("read_at", null);

    if (unreadError) {
      console.error(unreadError);
    } else {
      setUnreadMessages(unreadCount || 0);
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
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
            Training History
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            Past Workouts
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
            Review workouts you have completed and check your training history.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard title="Completed" value={`${submissions.length}`} />

          <SummaryCard
            title="Latest"
            value={
              submissions.length > 0
                ? formatDate(
                    submissions[0].submitted_at ||
                      submissions[0].completed_at ||
                      submissions[0].date ||
                      null
                  )
                : "None yet"
            }
          />

          <SummaryCard
            title="Pain Reports"
            value={`${countPainReports(submissions)}`}
            alert={countPainReports(submissions) > 0}
          />

          <SummaryCard
            title="Messages"
            value={`${unreadMessages}`}
            alert={unreadMessages > 0}
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Completed Sessions
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
            Workout History
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Tap any workout to open the full details.
          </p>
        </div>

        {statusMessage && (
          <p className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold text-slate-700">
            {statusMessage}
          </p>
        )}

        {isLoading ? (
          <p className="rounded-2xl bg-sky-50 p-5 text-sm font-semibold text-slate-600">
            Loading past workouts...
          </p>
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-6">
            <h2 className="text-lg font-black text-slate-900">
              No completed workouts yet
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
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
                  className="block rounded-2xl border border-sky-100 bg-sky-50 p-4 transition hover:border-blue-200 hover:bg-white hover:shadow-sm active:scale-[0.99] sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">
                        {workoutTitle}
                      </h2>

                      <p className="mt-1 text-sm font-medium text-slate-500">
                        {formatDate(submissionDate)}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                        painReported
                          ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                          : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      }`}
                    >
                      {painReported ? "Pain Reported" : "No Pain"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-sky-100">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Notes
                    </p>

                    <p className="mt-1 break-words text-sm font-black leading-6 text-slate-900 sm:text-base">
                      {notes}
                    </p>
                  </div>

                  <p className="mt-4 text-sm font-black text-blue-600">
                    View workout details →
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </ClientLayout>
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

function countPainReports(submissions: WorkoutSubmission[]) {
  return submissions.filter(
    (submission) => submission.pain_reported === true || submission.pain === true
  ).length;
}

function SummaryCard({
  title,
  value,
  alert = false,
}: {
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        alert ? "border-blue-200 bg-blue-50" : "border-sky-100 bg-sky-50"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2
        className={`mt-2 line-clamp-2 break-words text-xl font-black leading-tight sm:text-2xl ${
          alert ? "text-blue-700" : "text-slate-900"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}