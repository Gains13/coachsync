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
      title: string;
      date: string | null;
      notes: string;
      painReported: boolean;
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
      .eq("client_user_id", user.id);

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

      return {
        type: "program" as const,
        id: submission.id,
        title: workoutTitle,
        date: submissionDate,
        notes,
        painReported,
      };
    }),

    ...personalLogs.map((log) => {
      return {
        type: "personal" as const,
        id: log.id,
        title: log.title || "Personal Activity",
        date: log.logged_at || log.created_at,
        notes: log.notes || "No notes added",
        activityType: log.activity_type || "Activity",
        durationMinutes: log.duration_minutes,
        intensity: log.intensity || "Not set",
        location: log.location || "Not set",
      };
    }),

    ...historicalWorkouts.map((workout) => {
      return {
        type: "historical" as const,
        id: workout.id,
        title: workout.title || "Imported Past Workout",
        date: workout.workout_date || workout.created_at,
        notes: workout.notes || "Imported from trainer notes.",
        source: workout.source || "notes_import",
        exerciseCount: workout.client_historical_workout_exercises.length,
        previewExercises: workout.client_historical_workout_exercises.slice(
          0,
          5
        ),
      };
    }),
  ].sort((a, b) => {
    const dateA = getDateValue(a.date);
    const dateB = getDateValue(b.date);

    return dateB - dateA;
  });

  const painReportCount = programSubmissions.filter(
    (submission) => submission.pain_reported === true || submission.pain === true
  ).length;

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
            Review completed program workouts, personal activities, and imported
            workouts from your trainer’s notes.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-5 md:p-8">
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
            title="Pain Reports"
            value={`${painReportCount}`}
            alert={painReportCount > 0}
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
            Program workouts, personal activities, and imported past workouts are
            shown together, but labeled separately.
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
        ) : combinedItems.length === 0 ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-6">
            <h2 className="text-lg font-black text-slate-900">
              No completed workouts yet
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Once you complete assigned workouts, log personal activity, or your
              trainer imports past workouts, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {combinedItems.map((item) => {
              if (item.type === "program") {
                return (
                  <Link
                    key={`program-${item.id}`}
                    to={`/workout-history/${item.id}`}
                    className="block rounded-2xl border border-sky-100 bg-sky-50 p-4 transition hover:border-blue-200 hover:bg-white hover:shadow-sm active:scale-[0.99] sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                            Program Workout
                          </span>
                        </div>

                        <h2 className="text-lg font-black text-slate-900">
                          {item.title}
                        </h2>

                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {formatDate(item.date)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                          item.painReported
                            ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        }`}
                      >
                        {item.painReported ? "Pain Reported" : "No Pain"}
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-sky-100">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Notes
                      </p>

                      <p className="mt-1 break-words text-sm font-black leading-6 text-slate-900 sm:text-base">
                        {item.notes}
                      </p>
                    </div>

                    <p className="mt-4 text-sm font-black text-blue-600">
                      View workout details →
                    </p>
                  </Link>
                );
              }

              if (item.type === "personal") {
                return (
                  <div
                    key={`personal-${item.id}`}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                            Personal Activity
                          </span>

                          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-emerald-100">
                            {item.activityType}
                          </span>
                        </div>

                        <h2 className="text-lg font-black text-slate-900">
                          {item.title}
                        </h2>

                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {formatDate(item.date)}
                        </p>
                      </div>

                      <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
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
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Notes
                      </p>

                      <p className="mt-1 break-words text-sm font-black leading-6 text-slate-900 sm:text-base">
                        {item.notes}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`historical-${item.id}`}
                  className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200">
                          Imported Past Workout
                        </span>

                        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-amber-100">
                          Trainer Notes
                        </span>
                      </div>

                      <h2 className="text-lg font-black text-slate-900">
                        {item.title}
                      </h2>

                      <p className="mt-1 text-sm font-medium text-slate-500">
                        {formatDate(item.date)}
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">
                      {item.exerciseCount} exercise
                      {item.exerciseCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-amber-100">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Preview
                    </p>

                    {item.previewExercises.length === 0 ? (
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        No exercises listed.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {item.previewExercises.map((exercise) => (
                          <div
                            key={exercise.id}
                            className="rounded-xl bg-amber-50 p-3"
                          >
                            <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                              {exercise.section || "Workout"}
                            </p>

                            <p className="mt-1 text-sm font-black text-slate-900">
                              {exercise.exercise_name || exercise.raw_text}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {[
                                exercise.weight,
                                exercise.sets
                                  ? `${exercise.sets} sets`
                                  : "",
                                exercise.reps,
                                exercise.rest,
                              ]
                                .filter(Boolean)
                                .join(" • ") || exercise.raw_text}
                            </p>
                          </div>
                        ))}

                        {item.exerciseCount > item.previewExercises.length && (
                          <p className="pt-1 text-sm font-black text-amber-700">
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
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Notes
                    </p>

                    <p className="mt-1 break-words text-sm font-black leading-6 text-slate-900 sm:text-base">
                      {item.notes}
                    </p>
                  </div>

                  <Link
                    to={`/repeat-historical-workout/${item.id}`}
                    className="mt-4 block rounded-2xl bg-amber-500 px-4 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.99]"
                  >
                    Repeat This Workout
                  </Link>
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
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
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