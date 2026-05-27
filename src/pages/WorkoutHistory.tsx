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

type PersonalWorkoutLog = {
  id: string;
  client_user_id: string;
  activity_type: string | null;
  title: string | null;
  duration_minutes: number | null;
  location: string | null;
  intensity: string | null;
  notes: string | null;
  logged_at: string | null;
  created_at: string | null;
};

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type HistoryItem =
  | {
      type: "program";
      id: string;
      clientUserId: string;
      title: string;
      date: string | null;
      notes: string | null;
      workoutId: string | null;
      percent: number;
      completed: number;
      total: number;
    }
  | {
      type: "personal";
      id: string;
      clientUserId: string;
      title: string;
      date: string | null;
      notes: string | null;
      activityType: string;
      durationMinutes: number | null;
      intensity: string;
      location: string;
    };

export default function WorkoutHistory() {
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([]);
  const [personalLogs, setPersonalLogs] = useState<PersonalWorkoutLog[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filterMode, setFilterMode] = useState("all");

  useEffect(() => {
    loadWorkoutHistory();
  }, []);

  async function loadWorkoutHistory() {
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
        "Could not load workout history: " + submissionError.message
      );
      setIsLoading(false);
      return;
    }

    const { data: personalData, error: personalError } = await supabase
      .from("personal_workout_logs")
      .select(
        "id, client_user_id, activity_type, title, duration_minutes, location, intensity, notes, logged_at, created_at"
      )
      .order("logged_at", { ascending: false });

    if (personalError) {
      console.error(personalError);
      setStatusMessage(
        "Program workouts loaded, but personal activities could not be loaded: " +
          personalError.message
      );
    }

    const submissionsList = (submissionData || []) as WorkoutSubmission[];
    const personalLogsList = (personalData || []) as PersonalWorkoutLog[];

    setSubmissions(submissionsList);
    setPersonalLogs(personalLogsList);

    const clientIds = Array.from(
      new Set([
        ...submissionsList.map((submission) => submission.client_user_id),
        ...personalLogsList.map((log) => log.client_user_id),
      ])
    );

    if (clientIds.length > 0) {
      const { data: clientData, error: clientError } = await supabase
        .from("profiles")
        .select("id, full_name, client_id")
        .in("id", clientIds);

      if (clientError) {
        console.error(clientError);
        setStatusMessage(
          "Workout history loaded, but client names could not be loaded: " +
            clientError.message
        );
      } else {
        setClients((clientData || []) as ClientProfile[]);
      }
    }

    setIsLoading(false);
  }

  function getClientName(clientUserId: string) {
    const client = clients.find((client) => client.id === clientUserId);

    if (!client) return "Unknown Client";

    return client.full_name || client.client_id || "Unknown Client";
  }

  function getClientId(clientUserId: string) {
    const client = clients.find((client) => client.id === clientUserId);

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

  const historyItems = useMemo<HistoryItem[]>(() => {
    const programItems: HistoryItem[] = submissions.map((submission) => {
      const stats = getCompletionStats(submission);

      return {
        type: "program",
        id: submission.id,
        clientUserId: submission.client_user_id,
        title: submission.workout_title,
        date: submission.submitted_at,
        notes: submission.notes,
        workoutId: submission.workout_id,
        percent: stats.percent,
        completed: stats.completed,
        total: stats.total,
      };
    });

    const personalItems: HistoryItem[] = personalLogs.map((log) => ({
      type: "personal",
      id: log.id,
      clientUserId: log.client_user_id,
      title: log.title || "Personal Activity",
      date: log.logged_at || log.created_at,
      notes: log.notes,
      activityType: log.activity_type || "Activity",
      durationMinutes: log.duration_minutes,
      intensity: log.intensity || "Not set",
      location: log.location || "Not set",
    }));

    return [...programItems, ...personalItems].sort(
      (a, b) => getDateValue(b.date) - getDateValue(a.date)
    );
  }, [submissions, personalLogs]);

  const filteredItems = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return historyItems.filter((item) => {
      const clientName = getClientName(item.clientUserId).toLowerCase();
      const clientId = getClientId(item.clientUserId).toLowerCase();
      const title = item.title.toLowerCase();

      const typeText =
        item.type === "program"
          ? "program workout"
          : `personal activity ${item.activityType}`.toLowerCase();

      const matchesSearch =
        !search ||
        clientName.includes(search) ||
        clientId.includes(search) ||
        title.includes(search) ||
        typeText.includes(search);

      if (!matchesSearch) return false;

      if (filterMode === "program") {
        return item.type === "program";
      }

      if (filterMode === "personal") {
        return item.type === "personal";
      }

      return true;
    });
  }, [historyItems, clients, searchText, filterMode]);

  const uniqueClientCount = new Set(
    historyItems.map((item) => item.clientUserId)
  ).size;

  const averageCompletion =
    submissions.length > 0
      ? Math.round(
          submissions.reduce((total, submission) => {
            return total + getCompletionStats(submission).percent;
          }, 0) / submissions.length
        )
      : 0;

  const latestActivity =
    historyItems.length > 0 ? historyItems[0].title : "None yet";

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
                  Workout History
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Review submitted program workouts and personal activities from
                  your clients.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={loadWorkoutHistory}
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Refresh
                </button>

                <Link
                  to="/trainer"
                  className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:py-2"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-5 md:p-8">
            <SummaryCard title="Total Logs" value={`${historyItems.length}`} />
            <SummaryCard title="Program" value={`${submissions.length}`} />
            <SummaryCard title="Personal" value={`${personalLogs.length}`} />
            <SummaryCard title="Clients" value={`${uniqueClientCount}`} />
            <SummaryCard title="Latest" value={latestActivity} />
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Search History
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Search by client name, client ID, workout title, or activity
                title.
              </p>

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search workout history..."
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
                <option value="all">All history</option>
                <option value="program">Program workouts only</option>
                <option value="personal">Personal activities only</option>
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
            title="Loading workout history..."
            description="Checking Supabase for submitted workouts and personal activities."
          />
        ) : historyItems.length === 0 ? (
          <EmptyState
            title="No workout history yet"
            description="Completed client workouts and personal activities will appear here."
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title="No matching activity"
            description="Try searching a different client name, client ID, workout title, or activity title."
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredItems.map((item) => {
              const clientName = getClientName(item.clientUserId);
              const clientId = getClientId(item.clientUserId);

              if (item.type === "program") {
                return (
                  <div
                    key={`program-${item.id}`}
                    className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md sm:p-6"
                  >
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
                          🏋️
                        </div>

                        <span className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                          Program Workout
                        </span>

                        <h2 className="break-words text-xl font-bold text-slate-900">
                          {item.title}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {clientName} • Client ID: {clientId}
                        </p>
                      </div>

                      <span
                        className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                          item.percent === 100
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : item.percent > 0
                            ? "bg-blue-50 text-blue-700 ring-blue-100"
                            : "bg-red-50 text-red-700 ring-red-100"
                        }`}
                      >
                        {item.percent}% Complete
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <InfoBox
                        label="Submitted"
                        value={formatDate(item.date)}
                      />

                      <InfoBox
                        label="Exercises"
                        value={`${item.completed} / ${item.total}`}
                      />
                    </div>

                    <div className="mt-4 h-3 rounded-full bg-sky-50">
                      <div
                        className="h-3 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>

                    {item.notes && (
                      <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                        <p className="text-sm font-medium text-slate-500">
                          Notes
                        </p>

                        <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-800">
                          {item.notes}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <Link
                        to={`/workout-history/${item.id}`}
                        className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2"
                      >
                        Open Workout
                      </Link>

                      <Link
                        to={`/clients/${item.clientUserId}`}
                        className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:py-2"
                      >
                        View Client
                      </Link>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`personal-${item.id}`}
                  className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md sm:p-6"
                >
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-emerald-100">
                        🚶
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                          Personal Activity
                        </span>

                        <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-emerald-100">
                          {item.activityType}
                        </span>
                      </div>

                      <h2 className="break-words text-xl font-bold text-slate-900">
                        {item.title}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {clientName} • Client ID: {clientId}
                      </p>
                    </div>

                    <span className="w-fit shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                      {item.durationMinutes
                        ? `${item.durationMinutes} min`
                        : "Duration not set"}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBox label="Logged" value={formatDate(item.date)} />
                    <InfoBox label="Intensity" value={item.intensity} />
                    <InfoBox label="Location" value={item.location} />
                    <InfoBox
                      label="Duration"
                      value={
                        item.durationMinutes
                          ? `${item.durationMinutes} minutes`
                          : "Not set"
                      }
                    />
                  </div>

                  {item.notes && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4">
                      <p className="text-sm font-medium text-slate-500">
                        Notes
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-800">
                        {item.notes}
                      </p>
                    </div>
                  )}

                  <div className="mt-5">
                    <Link
                      to={`/clients/${item.clientUserId}`}
                      className="rounded-xl border border-emerald-100 bg-white px-4 py-3 text-center text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 sm:py-2"
                    >
                      View Client
                    </Link>
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

function getDateValue(value: string | null) {
  if (!value) return 0;

  const date = new Date(value);

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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-4">
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
        🕓
      </div>

      <h2 className="text-xl font-bold text-slate-900">{title}</h2>

      <p className="mt-2 text-slate-500">{description}</p>
    </div>
  );
}