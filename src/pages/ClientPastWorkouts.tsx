import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type WorkoutSubmission = {
  id: string;
  client_user_id?: string;
  workout_id?: string | null;
  workout_title?: string | null;
  title?: string | null;
  notes?: string | null;
  workout_notes?: string | null;
  pain_reported?: boolean | null;
  pain?: boolean | null;
  pain_location?: string | null;
  pain_level?: number | null;
  pain_exercise?: string | null;
  pain_notes?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  date?: string | null;
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

type HistoricalWorkoutExercise = {
  id: string;
  section: string | null;
  exercise_name: string | null;
  sets: string | null;
  reps: string | null;
  weight: string | null;
  rest: string | null;
  raw_text: string | null;
  exercise_order: number | null;
};

type HistoricalWorkout = {
  id: string;
  client_user_id: string;
  title: string;
  workout_date: string | null;
  source: string | null;
  notes: string | null;
  created_at: string | null;
  client_historical_workout_exercises: HistoricalWorkoutExercise[];
};

type CombinedWorkoutItem =
  | {
      type: "program";
      id: string;
      workoutId: string | null;
      title: string;
      date: string | null;
      notes: string;
      painReported: boolean;
      painLocation: string;
      painLevel: number | null;
      painExercise: string;
      painNotes: string;
      isRepeatedWorkout: boolean;
    }
  | {
      type: "personal";
      id: string;
      title: string;
      date: string | null;
      notes: string;
      activityType: string;
      durationMinutes: number | null;
      intensity: string;
      location: string;
    }
  | {
      type: "historical";
      id: string;
      title: string;
      date: string | null;
      notes: string;
      source: string;
      exerciseCount: number;
      previewExercises: HistoricalWorkoutExercise[];
    };

export default function ClientPastWorkouts() {
  const [programSubmissions, setProgramSubmissions] = useState<
    WorkoutSubmission[]
  >([]);
  const [personalLogs, setPersonalLogs] = useState<PersonalWorkoutLog[]>([]);
  const [historicalWorkouts, setHistoricalWorkouts] = useState<
    HistoricalWorkout[]
  >([]);

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

    const { data: programData, error: programError } = await supabase
      .from("workout_submissions")
      .select("*")
      .eq("client_user_id", user.id)
      .order("submitted_at", { ascending: false });

    if (programError) {
      setStatusMessage(
        "Could not load program workouts: " + programError.message
      );
      setIsLoading(false);
      return;
    }

    const { data: personalData, error: personalError } = await supabase
      .from("personal_workout_logs")
      .select("*")
      .eq("client_user_id", user.id)
      .order("logged_at", { ascending: false });

    if (personalError) {
      setStatusMessage(
        "Could not load personal activity logs: " + personalError.message
      );
      setIsLoading(false);
      return;
    }

    const { data: historicalData, error: historicalError } = await supabase
      .from("client_historical_workouts")
      .select(
        `
        id,
        client_user_id,
        title,
        workout_date,
        source,
        notes,
        created_at,
        client_historical_workout_exercises (
          id,
          section,
          exercise_name,
          sets,
          reps,
          weight,
          rest,
          raw_text,
          exercise_order
        )
      `
      )
      .eq("client_user_id", user.id)
      .order("workout_date", { ascending: false });

    if (historicalError) {
      setStatusMessage(
        "Could not load imported past workouts: " + historicalError.message
      );
      setIsLoading(false);
      return;
    }

    setProgramSubmissions((programData || []) as WorkoutSubmission[]);
    setPersonalLogs((personalData || []) as PersonalWorkoutLog[]);

    const cleanedHistoricalWorkouts = ((historicalData ||
      []) as HistoricalWorkout[]).map((workout) => ({
      ...workout,
      client_historical_workout_exercises: [
        ...(workout.client_historical_workout_exercises || []),
      ].sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0)),
    }));

    setHistoricalWorkouts(cleanedHistoricalWorkouts);
    setIsLoading(false);
  }

  const combinedItems: CombinedWorkoutItem[] = [
    ...programSubmissions.map((submission) => {
      const workoutTitle =
        submission.workout_title || submission.title || "Completed Workout";

      const notes =
        submission.notes || submission.workout_notes || "No notes added";

      const painReported =
        submission.pain_reported === true || submission.pain === true;

      const submissionDate =
        submission.submitted_at ||
        submission.completed_at ||
        submission.date ||
        null;

      const isRepeatedWorkout = workoutTitle
        .toLowerCase()
        .includes("repeated");

      return {
        type: "program" as const,
        id: submission.id,
        workoutId: submission.workout_id || null,
        title: workoutTitle,
        date: submissionDate,
        notes,
        painReported,
        painLocation: submission.pain_location || "Not specified",
        painLevel: submission.pain_level ?? null,
        painExercise: submission.pain_exercise || "Not specified",
        painNotes: submission.pain_notes || "No pain notes added",
        isRepeatedWorkout,
      };
    }),

    ...personalLogs.map((log) => ({
      type: "personal" as const,
      id: log.id,
      title: log.title || "Personal Activity",
      date: log.logged_at || log.created_at,
      notes: log.notes || "No notes added",
      activityType: log.activity_type || "Activity",
      durationMinutes: log.duration_minutes,
      intensity: log.intensity || "Not set",
      location: log.location || "Not set",
    })),

    ...historicalWorkouts.map((workout) => ({
      type: "historical" as const,
      id: workout.id,
      title: workout.title || "Imported Past Workout",
      date: workout.workout_date || workout.created_at,
      notes: workout.notes || "Imported from trainer notes.",
      source: workout.source || "notes_import",
      exerciseCount: workout.client_historical_workout_exercises.length,
      previewExercises: workout.client_historical_workout_exercises.slice(0, 5),
    })),
  ].sort((a, b) => getDateValue(b.date) - getDateValue(a.date));

  const repeatedWorkoutCount = programSubmissions.filter((submission) => {
    const workoutTitle =
      submission.workout_title || submission.title || "Completed Workout";

    return workoutTitle.toLowerCase().includes("repeated");
  }).length;

  const painReportCount = programSubmissions.filter(
    (submission) => submission.pain_reported === true || submission.pain === true
  ).length;

  const highPainReportCount = programSubmissions.filter((submission) => {
    const painReported =
      submission.pain_reported === true || submission.pain === true;

    return (
      painReported &&
      typeof submission.pain_level === "number" &&
      submission.pain_level >= 7
    );
  }).length;

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 sm:mb-6">
        <div className="mb-4">
          <p className="text-sm text-muted">
            Training History
          </p>

          <h1 className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-[30px]">
            Past Workouts
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Review completed program workouts, repeat past sessions, view
            personal activities, and check pain reports.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-6">
          <SummaryCard title="Total Logs" value={`${combinedItems.length}`} />

          <SummaryCard
            title="Program"
            value={`${programSubmissions.length}`}
          />

          <SummaryCard title="Personal" value={`${personalLogs.length}`} />

          <SummaryCard
            title="Imported"
            value={`${historicalWorkouts.length}`}
          />

          <SummaryCard
            title="Repeated"
            value={`${repeatedWorkoutCount}`}
            alert={repeatedWorkoutCount > 0}
          />

          <SummaryCard
            title="Pain Reports"
            value={`${painReportCount}`}
            danger={painReportCount > 0}
          />
        </div>

        {painReportCount > 0 && (
          <div className="mt-3">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">
                {painReportCount} pain report
                {painReportCount === 1 ? "" : "s"} found in completed workouts.
              </p>

              {highPainReportCount > 0 && (
                <p className="mt-1 text-sm font-semibold text-red-600">
                  {highPainReportCount} report
                  {highPainReportCount === 1 ? "" : "s"} marked as 7/10 or
                  higher.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[18px] border border-line bg-white p-4 sm:rounded-[18px] sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            Completed Sessions
          </p>

          <h2 className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            Workout History
          </h2>

          <p className="mt-1 text-sm leading-6 text-muted">
            Program workouts now show separate buttons for viewing details and
            repeating the workout.
          </p>
        </div>

        {statusMessage && (
          <p className="mb-5 rounded-2xl border border-line bg-canvas p-4 text-sm font-semibold text-ink/80">
            {statusMessage}
          </p>
        )}

        {isLoading ? (
          <p className="rounded-2xl bg-canvas p-5 text-sm font-semibold text-muted">
            Loading past workouts...
          </p>
        ) : combinedItems.length === 0 ? (
          <div className="rounded-2xl border border-line bg-canvas p-6">
            <h2 className="text-lg font-bold text-ink">
              No completed workouts yet
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted">
              Once you complete assigned workouts, log personal activity, or your
              trainer imports past workouts, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {combinedItems.map((item) => {
              if (item.type === "program") {
                return (
                  <div
                    key={`program-${item.id}`}
                    className={`rounded-2xl border p-4 transition sm:p-5 ${
                      item.isRepeatedWorkout
                        ? "border-amber-100 bg-amber-50"
                        : item.painReported
                        ? "border-red-100 bg-red-50"
                        : "border-line bg-canvas"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                              item.isRepeatedWorkout
                                ? "bg-amber-100 text-amber-700 ring-amber-200"
                                : item.painReported
                                ? "bg-red-100 text-red-700 ring-red-200"
                                : "bg-accent-soft text-accent ring-line"
                            }`}
                          >
                            {item.isRepeatedWorkout
                              ? "Repeated Workout"
                              : "Program Workout"}
                          </span>

                          {item.isRepeatedWorkout && (
                            <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-muted ring-1 ring-amber-100">
                              From Past Workout
                            </span>
                          )}
                        </div>

                        <h2 className="text-lg font-bold text-ink">
                          {item.title}
                        </h2>

                        <p className="mt-1 text-sm font-medium text-muted">
                          {formatDate(item.date)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                          item.painReported
                            ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        }`}
                      >
                        {item.painReported ? "Pain Reported" : "No Pain"}
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-line">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">
                        Notes
                      </p>

                      <p className="mt-1 break-words text-sm font-bold leading-6 text-ink sm:text-base">
                        {item.notes}
                      </p>
                    </div>

                    {item.painReported && (
                      <div className="mt-4 rounded-2xl border border-red-100 bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-red-600">
                              Pain & Discomfort Report
                            </p>

                            <h3 className="mt-1 text-base font-bold text-red-700">
                              {item.painLevel
                                ? `${item.painLevel}/10 pain level`
                                : "Pain level not recorded"}
                            </h3>
                          </div>

                          {item.painLevel && item.painLevel >= 7 && (
                            <span className="w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
                              High Priority
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <PainInfo
                            label="Location"
                            value={item.painLocation}
                          />

                          <PainInfo
                            label="Exercise"
                            value={item.painExercise}
                          />

                          <PainInfo
                            label="Level"
                            value={
                              item.painLevel
                                ? `${item.painLevel}/10`
                                : "Not recorded"
                            }
                          />
                        </div>

                        <div className="mt-3 rounded-2xl bg-red-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-red-600">
                            Pain Notes
                          </p>

                          <p className="mt-1 break-words text-sm font-semibold leading-6 text-ink">
                            {item.painNotes}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Link
                        to={`/workout-history/${item.id}`}
                        className={`block rounded-2xl px-4 py-3 text-center text-sm font-bold  transition active:scale-[0.99] ${
                          item.painReported
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : item.isRepeatedWorkout
                            ? "bg-amber-500 text-white hover:bg-amber-600"
                            : "bg-accent text-white hover:bg-accent-dark"
                        }`}
                      >
                        View Details
                      </Link>

                      {item.workoutId ? (
                        <Link
                          to={`/start-workout?workoutId=${item.workoutId}&repeat=true&sourceSubmissionId=${item.id}`}
                          className="block rounded-2xl border border-line bg-white px-4 py-3 text-center text-sm font-bold text-ink transition hover:bg-canvas active:scale-[0.99]"
                        >
                          Repeat This Workout
                        </Link>
                      ) : (
                        <span className="block rounded-2xl border border-slate-100 bg-white px-4 py-3 text-center text-sm font-bold text-muted">
                          Repeat Not Available
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              if (item.type === "personal") {
                return (
                  <div
                    key={`personal-${item.id}`}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                            Personal Activity
                          </span>

                          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-muted ring-1 ring-emerald-100">
                            {item.activityType}
                          </span>
                        </div>

                        <h2 className="text-lg font-bold text-ink">
                          {item.title}
                        </h2>

                        <p className="mt-1 text-sm font-medium text-muted">
                          {formatDate(item.date)}
                        </p>
                      </div>

                      <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                        {item.durationMinutes
                          ? `${item.durationMinutes} min`
                          : "Duration not set"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MiniInfo label="Intensity" value={item.intensity} />
                      <MiniInfo label="Location" value={item.location} />
                      <MiniInfo
                        label="Duration"
                        value={
                          item.durationMinutes
                            ? `${item.durationMinutes} minutes`
                            : "Not set"
                        }
                      />
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-emerald-100">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">
                        Notes
                      </p>

                      <p className="mt-1 break-words text-sm font-bold leading-6 text-ink sm:text-base">
                        {item.notes}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`historical-${item.id}`}
                  className="rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                          Imported Past Workout
                        </span>

                        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-muted ring-1 ring-amber-100">
                          Trainer Notes
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-ink">
                        {item.title}
                      </h2>

                      <p className="mt-1 text-sm font-medium text-muted">
                        {formatDate(item.date)}
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-100">
                      {item.exerciseCount} exercise
                      {item.exerciseCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-amber-100">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Preview
                    </p>

                    {item.previewExercises.length === 0 ? (
                      <p className="mt-2 text-sm font-semibold text-muted">
                        No exercises listed.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {item.previewExercises.map((exercise) => (
                          <div
                            key={exercise.id}
                            className="rounded-xl bg-amber-50 p-3"
                          >
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                              {exercise.section || "Workout"}
                            </p>

                            <p className="mt-1 text-sm font-bold text-ink">
                              {exercise.exercise_name || exercise.raw_text}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-muted">
                              {[
                                exercise.weight,
                                exercise.sets ? `${exercise.sets} sets` : "",
                                exercise.reps,
                                exercise.rest,
                              ]
                                .filter(Boolean)
                                .join(" • ") || exercise.raw_text}
                            </p>
                          </div>
                        ))}

                        {item.exerciseCount > item.previewExercises.length && (
                          <p className="pt-1 text-sm font-bold text-amber-700">
                            + {item.exerciseCount - item.previewExercises.length}{" "}
                            more exercise
                            {item.exerciseCount -
                              item.previewExercises.length ===
                            1
                              ? ""
                              : "s"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-amber-100">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Notes
                    </p>

                    <p className="mt-1 break-words text-sm font-bold leading-6 text-ink sm:text-base">
                      {item.notes}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Link
                      to={`/client-historical-workout/${item.id}`}
                      className="block rounded-2xl border border-amber-100 bg-white px-4 py-3 text-center text-sm font-bold text-amber-700 transition hover:bg-amber-50 active:scale-[0.99]"
                    >
                      View Details
                    </Link>

                    <Link
                      to={`/repeat-historical-workout/${item.id}`}
                      className="block rounded-2xl bg-amber-500 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-amber-600 active:scale-[0.99]"
                    >
                      Repeat This Workout
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </ClientLayout>
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

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-100">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-ink">
        {value}
      </p>
    </div>
  );
}

function PainInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
      <p className="text-xs font-bold uppercase tracking-wide text-red-600">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-ink">
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  alert = false,
  danger = false,
}: {
  title: string;
  value: string;
  alert?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4  ${
        danger
          ? "border-red-200 bg-red-50"
          : alert
          ? "border-accent/30 bg-accent-soft"
          : "border-line bg-canvas"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {title}
      </p>

      <h2
        className={`mt-2 line-clamp-2 break-words text-xl font-bold leading-tight sm:text-2xl ${
          danger ? "text-red-700" : alert ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}