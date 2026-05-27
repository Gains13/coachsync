import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type SubmissionExercise = {
  id: string;
  completed: boolean;
};

type WorkoutSubmission = {
  id: string;
  client_user_id: string;
  workout_id: string | null;
  workout_title: string;
  submitted_at: string;
  notes: string | null;
  workout_submission_exercises: SubmissionExercise[];
};

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type ClientWorkoutGroup = {
  client: ClientProfile | null;
  clientUserId: string;
  submissions: WorkoutSubmission[];
  totalSubmissions: number;
  averageCompletion: number;
  latestWorkoutTitle: string;
  latestSubmittedAt: string;
};

export default function WorkoutTracker() {
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filterMode, setFilterMode] = useState("all");

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    setIsLoading(true);
    setStatusMessage("");

    const { data: submissionData, error: submissionError } = await supabase
      .from("workout_submissions")
      .select(
        `
        id,
        client_user_id,
        workout_id,
        workout_title,
        submitted_at,
        notes,
        workout_submission_exercises (
          id,
          completed
        )
      `
      )
      .order("submitted_at", { ascending: false });

    if (submissionError) {
      console.error(submissionError);
      setStatusMessage(
        "Could not load workout submissions: " + submissionError.message
      );
      setIsLoading(false);
      return;
    }

    const submissionsList = (submissionData || []) as WorkoutSubmission[];
    setSubmissions(submissionsList);

    const clientIds = Array.from(
      new Set(submissionsList.map((submission) => submission.client_user_id))
    );

    if (clientIds.length > 0) {
      const { data: clientData, error: clientError } = await supabase
        .from("profiles")
        .select("id, full_name, client_id")
        .in("id", clientIds);

      if (clientError) {
        console.error(clientError);
        setStatusMessage(
          "Submissions loaded, but client names could not be loaded: " +
            clientError.message
        );
      } else {
        setClients((clientData || []) as ClientProfile[]);
      }
    }

    setIsLoading(false);
  }

  function getClient(clientUserId: string) {
    return clients.find((client) => client.id === clientUserId) || null;
  }

  function getClientName(clientUserId: string) {
    const client = getClient(clientUserId);

    if (!client) return "Unknown Client";

    return client.full_name || client.client_id || "Unknown Client";
  }

  function getClientId(clientUserId: string) {
    const client = getClient(clientUserId);

    return client?.client_id || "Not set";
  }

  function getCompletionStats(submission: WorkoutSubmission) {
    const exercises = submission.workout_submission_exercises || [];
    const total = exercises.length;
    const completed = exercises.filter((exercise) => exercise.completed).length;

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      percent,
    };
  }

  function getAverageCompletion(clientSubmissions: WorkoutSubmission[]) {
    if (clientSubmissions.length === 0) return 0;

    const totalPercent = clientSubmissions.reduce((total, submission) => {
      return total + getCompletionStats(submission).percent;
    }, 0);

    return Math.round(totalPercent / clientSubmissions.length);
  }

  const groupedClients = useMemo<ClientWorkoutGroup[]>(() => {
    const grouped = new Map<string, WorkoutSubmission[]>();

    submissions.forEach((submission) => {
      const existing = grouped.get(submission.client_user_id) || [];
      grouped.set(submission.client_user_id, [...existing, submission]);
    });

    return Array.from(grouped.entries())
      .map(([clientUserId, clientSubmissions]) => {
        const sortedSubmissions = [...clientSubmissions].sort(
          (a, b) =>
            new Date(b.submitted_at).getTime() -
            new Date(a.submitted_at).getTime()
        );

        const latestSubmission = sortedSubmissions[0];

        return {
          client: getClient(clientUserId),
          clientUserId,
          submissions: sortedSubmissions,
          totalSubmissions: sortedSubmissions.length,
          averageCompletion: getAverageCompletion(sortedSubmissions),
          latestWorkoutTitle: latestSubmission?.workout_title || "None yet",
          latestSubmittedAt: latestSubmission?.submitted_at || "",
        };
      })
      .sort((a, b) => {
        const aDate = a.latestSubmittedAt
          ? new Date(a.latestSubmittedAt).getTime()
          : 0;

        const bDate = b.latestSubmittedAt
          ? new Date(b.latestSubmittedAt).getTime()
          : 0;

        return bDate - aDate;
      });
  }, [submissions, clients]);

  const filteredClientGroups = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return groupedClients.filter((group) => {
      const clientName = getClientName(group.clientUserId).toLowerCase();
      const clientId = getClientId(group.clientUserId).toLowerCase();

      const matchesSearch =
        !search ||
        clientName.includes(search) ||
        clientId.includes(search) ||
        group.submissions.some((submission) =>
          submission.workout_title.toLowerCase().includes(search)
        );

      if (!matchesSearch) return false;

      if (filterMode === "perfect") {
        return group.submissions.some(
          (submission) => getCompletionStats(submission).percent === 100
        );
      }

      if (filterMode === "incomplete") {
        return group.submissions.some(
          (submission) => getCompletionStats(submission).percent < 100
        );
      }

      return true;
    });
  }, [groupedClients, searchText, filterMode]);

  const totalSubmissions = submissions.length;
  const totalClients = groupedClients.length;

  const averageCompletion =
    submissions.length > 0
      ? Math.round(
          submissions.reduce((total, submission) => {
            return total + getCompletionStats(submission).percent;
          }, 0) / submissions.length
        )
      : 0;

  const latestWorkout = submissions[0]?.workout_title || "None yet";

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Trainer Tools
                </p>

                <h1 className="mt-3 break-words text-3xl font-bold md:text-4xl">
                  Workout Tracker
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Track submitted workouts by client, review completion
                  percentages, and quickly open workout details.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={loadSubmissions}
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Refresh
                </button>

                <Link
                  to="/workout-history"
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Full History
                </Link>

                <Link
                  to="/trainer"
                  className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:py-2"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-4 md:p-8">
            <SummaryCard title="Submissions" value={`${totalSubmissions}`} />

            <SummaryCard title="Clients Active" value={`${totalClients}`} />

            <SummaryCard
              title="Average Completion"
              value={`${averageCompletion}%`}
            />

            <SummaryCard title="Latest" value={latestWorkout} />
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Clients with Submitted Workouts
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Search by client name, client ID, or workout title.
              </p>

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search client or workout..."
                className="mt-4 w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Filter
              </label>

              <select
                value={filterMode}
                onChange={(event) => setFilterMode(event.target.value)}
                className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All submissions</option>
                <option value="perfect">Has 100% workout</option>
                <option value="incomplete">Has incomplete workout</option>
              </select>
            </div>
          </div>
        </div>

        {statusMessage && (
          <p className="mb-6 rounded-2xl border border-sky-100 bg-white p-4 text-sm font-medium leading-6 text-slate-700 shadow-sm">
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
        ) : filteredClientGroups.length === 0 ? (
          <EmptyState
            title="No matching clients or workouts"
            description="Try searching a different client name, client ID, or workout title."
          />
        ) : (
          <div className="space-y-6">
            {filteredClientGroups.map((group) => {
              const clientName = getClientName(group.clientUserId);
              const clientId = getClientId(group.clientUserId);

              return (
                <div
                  key={group.clientUserId}
                  className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm"
                >
                  <div className="border-b border-sky-100 bg-sky-50 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-sky-100">
                          👤
                        </div>

                        <h2 className="break-words text-2xl font-bold text-slate-900">
                          {clientName}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Client ID: {clientId}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                        <MiniStat
                          label="Submitted"
                          value={`${group.totalSubmissions}`}
                        />

                        <MiniStat
                          label="Average"
                          value={`${group.averageCompletion}%`}
                        />

                        <MiniStat
                          label="Latest"
                          value={
                            group.latestSubmittedAt
                              ? new Date(
                                  group.latestSubmittedAt
                                ).toLocaleDateString()
                              : "None"
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <Link
                        to={`/clients/${group.clientUserId}`}
                        className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2"
                      >
                        Open Client
                      </Link>

                      <Link
                        to="/workout-history"
                        className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:py-2"
                      >
                        Full History
                      </Link>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">
                      Submitted Workouts
                    </h3>

                    <div className="space-y-3">
                      {group.submissions.map((submission) => {
                        const stats = getCompletionStats(submission);

                        return (
                          <div
                            key={submission.id}
                            className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <h4 className="font-bold text-slate-900">
                                  {submission.workout_title}
                                </h4>

                                <p className="mt-1 text-sm text-slate-500">
                                  Submitted{" "}
                                  {new Date(
                                    submission.submitted_at
                                  ).toLocaleString()}
                                </p>
                              </div>

                              <span
                                className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                                  stats.percent === 100
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                    : stats.percent > 0
                                    ? "bg-blue-50 text-blue-700 ring-blue-100"
                                    : "bg-red-50 text-red-700 ring-red-100"
                                }`}
                              >
                                {stats.percent}% Complete
                              </span>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <InfoBox
                                label="Exercises"
                                value={`${stats.completed} / ${stats.total}`}
                              />

                              <InfoBox
                                label="Workout ID"
                                value={submission.workout_id || "Not saved"}
                              />
                            </div>

                            <div className="mt-4 h-3 rounded-full bg-sky-50">
                              <div
                                className="h-3 rounded-full bg-blue-600 transition-all"
                                style={{ width: `${stats.percent}%` }}
                              />
                            </div>

                            {submission.notes && (
                              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                                <p className="text-sm font-medium text-slate-500">
                                  Notes
                                </p>

                                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-800">
                                  {submission.notes}
                                </p>
                              </div>
                            )}

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                              <Link
                                to={`/workout-history/${submission.id}`}
                                className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2"
                              >
                                Open Workout
                              </Link>

                              <Link
                                to={`/clients/${submission.client_user_id}`}
                                className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:py-2"
                              >
                                View Client
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-1 line-clamp-2 break-words text-sm font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
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