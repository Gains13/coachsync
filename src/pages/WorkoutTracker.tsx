import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type SubmissionExercise = {
  id: string;
  exercise_name: string | null;
  completed: boolean;
  notes: string | null;
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

type ClientWorkoutGroup = {
  clientUserId: string;
  submissions: WorkoutSubmission[];
  personalLogs: PersonalWorkoutLog[];
  totalProgramWorkouts: number;
  totalPersonalActivities: number;
  totalExerciseNotes: number;
  averageCompletion: number;
  latestActivityTitle: string;
  latestActivityDate: string | null;
};

export default function WorkoutTracker() {
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([]);
  const [personalLogs, setPersonalLogs] = useState<PersonalWorkoutLog[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientUserId, setSelectedClientUserId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filterMode, setFilterMode] = useState("all");

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
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
          exercise_name,
          completed,
          notes
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

    const { data: personalData, error: personalError } = await supabase
      .from("personal_workout_logs")
      .select(
        "id, client_user_id, activity_type, title, duration_minutes, location, intensity, notes, logged_at, created_at"
      )
      .order("logged_at", { ascending: false });

    if (personalError) {
      console.error(personalError);
      setStatusMessage(
        "Program workouts loaded, but personal activity logs could not be loaded: " +
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
          "Activity loaded, but client names could not be loaded: " +
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

  function getExerciseNoteCount(clientSubmissions: WorkoutSubmission[]) {
    return clientSubmissions.reduce((total, submission) => {
      const notes = (submission.workout_submission_exercises || []).filter(
        (exercise) => exercise.notes && exercise.notes.trim() !== ""
      );

      return total + notes.length;
    }, 0);
  }

  function getLatestActivityDate(
    clientSubmissions: WorkoutSubmission[],
    clientPersonalLogs: PersonalWorkoutLog[]
  ) {
    const dates = [
      ...clientSubmissions.map((submission) => submission.submitted_at),
      ...clientPersonalLogs.map((log) => log.logged_at || log.created_at || ""),
    ].filter(Boolean);

    if (dates.length === 0) return null;

    return dates.sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    )[0];
  }

  function getLatestActivityTitle(
    clientSubmissions: WorkoutSubmission[],
    clientPersonalLogs: PersonalWorkoutLog[]
  ) {
    const activities = [
      ...clientSubmissions.map((submission) => ({
        title: submission.workout_title,
        date: submission.submitted_at,
      })),
      ...clientPersonalLogs.map((log) => ({
        title: log.title || log.activity_type || "Personal Activity",
        date: log.logged_at || log.created_at || "",
      })),
    ].filter((activity) => activity.date);

    if (activities.length === 0) return "None yet";

    activities.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return activities[0].title;
  }

  const groupedClients = useMemo<ClientWorkoutGroup[]>(() => {
    const clientIds = Array.from(
      new Set([
        ...submissions.map((submission) => submission.client_user_id),
        ...personalLogs.map((log) => log.client_user_id),
      ])
    );

    return clientIds
      .map((clientUserId) => {
        const clientSubmissions = submissions
          .filter((submission) => submission.client_user_id === clientUserId)
          .sort(
            (a, b) =>
              new Date(b.submitted_at).getTime() -
              new Date(a.submitted_at).getTime()
          );

        const clientPersonalLogs = personalLogs
          .filter((log) => log.client_user_id === clientUserId)
          .sort(
            (a, b) =>
              getDateValue(b.logged_at || b.created_at) -
              getDateValue(a.logged_at || a.created_at)
          );

        return {
          clientUserId,
          submissions: clientSubmissions,
          personalLogs: clientPersonalLogs,
          totalProgramWorkouts: clientSubmissions.length,
          totalPersonalActivities: clientPersonalLogs.length,
          totalExerciseNotes: getExerciseNoteCount(clientSubmissions),
          averageCompletion: getAverageCompletion(clientSubmissions),
          latestActivityTitle: getLatestActivityTitle(
            clientSubmissions,
            clientPersonalLogs
          ),
          latestActivityDate: getLatestActivityDate(
            clientSubmissions,
            clientPersonalLogs
          ),
        };
      })
      .sort((a, b) => {
        const aDate = a.latestActivityDate
          ? new Date(a.latestActivityDate).getTime()
          : 0;

        const bDate = b.latestActivityDate
          ? new Date(b.latestActivityDate).getTime()
          : 0;

        return bDate - aDate;
      });
  }, [submissions, personalLogs, clients]);

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
        ) ||
        group.personalLogs.some((log) => {
          const title = log.title || "";
          const type = log.activity_type || "";

          return (
            title.toLowerCase().includes(search) ||
            type.toLowerCase().includes(search)
          );
        });

      if (!matchesSearch) return false;

      if (filterMode === "program") {
        return group.totalProgramWorkouts > 0;
      }

      if (filterMode === "personal") {
        return group.totalPersonalActivities > 0;
      }

      if (filterMode === "notes") {
        return group.totalExerciseNotes > 0;
      }

      return true;
    });
  }, [groupedClients, searchText, filterMode, clients]);

  const selectedGroup = selectedClientUserId
    ? groupedClients.find((group) => group.clientUserId === selectedClientUserId)
    : null;

  const totalProgramWorkouts = submissions.length;
  const totalPersonalActivities = personalLogs.length;
  const totalClients = groupedClients.length;

  const averageCompletion =
    submissions.length > 0
      ? Math.round(
          submissions.reduce((total, submission) => {
            return total + getCompletionStats(submission).percent;
          }, 0) / submissions.length
        )
      : 0;

  const latestActivity =
    groupedClients.length > 0 ? groupedClients[0].latestActivityTitle : "None yet";

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
                  Click a client to view their program workouts, personal
                  activities, and exercise notes.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={loadActivity}
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

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-5 md:p-8">
            <SummaryCard title="Clients" value={`${totalClients}`} />
            <SummaryCard title="Program" value={`${totalProgramWorkouts}`} />
            <SummaryCard title="Personal" value={`${totalPersonalActivities}`} />
            <SummaryCard title="Avg Completion" value={`${averageCompletion}%`} />
            <SummaryCard title="Latest" value={latestActivity} />
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {selectedGroup
                  ? `${getClientName(selectedGroup.clientUserId)} Activity`
                  : "Clients with Activity"}
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                {selectedGroup
                  ? "Viewing only this client’s program workouts and personal activities."
                  : "Search by client name, client ID, workout title, or activity title."}
              </p>

              {!selectedGroup && (
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search client, workout, or activity..."
                  className="mt-4 w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              )}
            </div>

            <div>
              {selectedGroup ? (
                <button
                  type="button"
                  onClick={() => setSelectedClientUserId("")}
                  className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  Back to All Clients
                </button>
              ) : (
                <>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Filter
                  </label>

                  <select
                    value={filterMode}
                    onChange={(event) => setFilterMode(event.target.value)}
                    className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All activity</option>
                    <option value="program">Has program workouts</option>
                    <option value="personal">Has personal activities</option>
                    <option value="notes">Has exercise notes</option>
                  </select>
                </>
              )}
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
            title="Loading activity..."
            description="Checking Supabase for program workouts and personal activities."
          />
        ) : groupedClients.length === 0 ? (
          <EmptyState
            title="No workout activity yet"
            description="Client program workouts and personal activity logs will appear here."
          />
        ) : selectedGroup ? (
          <ClientActivityView
            group={selectedGroup}
            getClientName={getClientName}
            getClientId={getClientId}
            getCompletionStats={getCompletionStats}
          />
        ) : filteredClientGroups.length === 0 ? (
          <EmptyState
            title="No matching clients"
            description="Try searching a different client name, client ID, workout title, or activity title."
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredClientGroups.map((group) => (
              <button
                key={group.clientUserId}
                type="button"
                onClick={() => setSelectedClientUserId(group.clientUserId)}
                className="rounded-3xl border border-sky-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md sm:p-6"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
                      👤
                    </div>

                    <h2 className="break-words text-xl font-bold text-slate-900">
                      {getClientName(group.clientUserId)}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Client ID: {getClientId(group.clientUserId)}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                    Open Activity →
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat
                    label="Program"
                    value={`${group.totalProgramWorkouts}`}
                  />

                  <MiniStat
                    label="Personal"
                    value={`${group.totalPersonalActivities}`}
                  />

                  <MiniStat label="Notes" value={`${group.totalExerciseNotes}`} />
                </div>

                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Latest Activity
                  </p>

                  <p className="mt-1 line-clamp-2 font-semibold text-slate-900">
                    {group.latestActivityTitle}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {group.latestActivityDate
                      ? new Date(group.latestActivityDate).toLocaleDateString()
                      : "No date"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ClientActivityView({
  group,
  getClientName,
  getClientId,
  getCompletionStats,
}: {
  group: ClientWorkoutGroup;
  getClientName: (clientUserId: string) => string;
  getClientId: (clientUserId: string) => string;
  getCompletionStats: (submission: WorkoutSubmission) => {
    total: number;
    completed: number;
    percent: number;
  };
}) {
  const exerciseNotes = group.submissions.flatMap((submission) => {
    return (submission.workout_submission_exercises || [])
      .filter((exercise) => exercise.notes && exercise.notes.trim() !== "")
      .map((exercise) => ({
        submission,
        exercise,
      }));
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm">
        <div className="border-b border-sky-100 bg-sky-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {getClientName(group.clientUserId)}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Client ID: {getClientId(group.clientUserId)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[620px]">
              <MiniStat label="Program" value={`${group.totalProgramWorkouts}`} />
              <MiniStat
                label="Personal"
                value={`${group.totalPersonalActivities}`}
              />
              <MiniStat label="Notes" value={`${group.totalExerciseNotes}`} />
              <MiniStat label="Average" value={`${group.averageCompletion}%`} />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              to={`/clients/${group.clientUserId}`}
              className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2"
            >
              Open Client Profile
            </Link>

            <Link
              to="/workout-history"
              className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:py-2"
            >
              Full History
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-xl font-bold text-slate-900">Program Workouts</h3>

        {group.submissions.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm text-slate-500">
            No program workouts submitted yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {group.submissions.map((submission) => {
              const stats = getCompletionStats(submission);

              return (
                <div
                  key={submission.id}
                  className="rounded-2xl border border-sky-100 bg-sky-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">
                        {submission.workout_title}
                      </h4>

                      <p className="mt-1 text-sm text-slate-500">
                        Submitted{" "}
                        {new Date(submission.submitted_at).toLocaleString()}
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

                  <div className="mt-4 h-3 rounded-full bg-white">
                    <div
                      className="h-3 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to={`/workout-history/${submission.id}`}
                      className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2"
                    >
                      Open Workout
                    </Link>

                    <Link
                      to={`/clients/${submission.client_user_id}`}
                      className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:py-2"
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

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm sm:p-6">
        <h3 className="text-xl font-bold text-slate-900">Personal Activities</h3>

        {group.personalLogs.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">
            No personal activities logged yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {group.personalLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-emerald-100 bg-white p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        Personal Activity
                      </span>

                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-slate-600">
                        {log.activity_type || "Activity"}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900">
                      {log.title || "Personal Activity"}
                    </h4>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatDateTime(log.logged_at || log.created_at)}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                    {log.duration_minutes
                      ? `${log.duration_minutes} min`
                      : "Duration not set"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <InfoBox label="Intensity" value={log.intensity || "Not set"} />
                  <InfoBox label="Location" value={log.location || "Not set"} />
                  <InfoBox
                    label="Notes"
                    value={log.notes || "No notes added"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm sm:p-6">
        <h3 className="text-xl font-bold text-slate-900">Exercise Notes</h3>

        {exerciseNotes.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">
            No exercise notes from this client yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {exerciseNotes.map(({ submission, exercise }) => (
              <Link
                key={exercise.id}
                to={`/workout-history/${submission.id}`}
                className="block rounded-2xl border border-amber-100 bg-white p-4 transition hover:border-amber-200 hover:shadow-sm"
              >
                <p className="text-sm font-bold text-amber-700">
                  {exercise.exercise_name || "Exercise Note"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  From {submission.workout_title}
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">
                  {exercise.notes}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getDateValue(value: string | null | undefined) {
  if (!value) return 0;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 0;

  return date.getTime();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Date not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date not recorded";

  return date.toLocaleString();
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