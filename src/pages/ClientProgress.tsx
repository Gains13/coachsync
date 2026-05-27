import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type SubmissionExercise = {
  id?: string;
  exercise_name?: string;
  name?: string;
  sets?: string | number | null;
  reps?: string | number | null;
  weight?: string | number | null;
  notes?: string | null;
};

type WorkoutSubmission = {
  id: string;
  client_user_id: string;
  workout_title?: string | null;
  submitted_at?: string | null;
  workout_submission_exercises?: SubmissionExercise[];
};

type ExerciseProgress = {
  exerciseName: string;
  bestWeight: number;
  bestVolume: number;
  totalSets: number;
  totalReps: number;
  entries: number;
};

export default function ClientProgress() {
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    setIsLoading(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in to view progress.");
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
      .select(
        "id, client_user_id, workout_title, submitted_at, workout_submission_exercises(*)"
      )
      .eq("client_user_id", user.id)
      .order("submitted_at", { ascending: false });

    if (error) {
      setStatusMessage("Could not load progress: " + error.message);
      setIsLoading(false);
      return;
    }

    setSubmissions((data || []) as WorkoutSubmission[]);
    setIsLoading(false);
  }

  const progressData = useMemo(() => {
    const exerciseMap = new Map<string, ExerciseProgress>();

    submissions.forEach((submission) => {
      const exercises = submission.workout_submission_exercises || [];

      exercises.forEach((exercise) => {
        const exerciseName =
          exercise.exercise_name || exercise.name || "Unnamed Exercise";

        const weight = parseNumber(exercise.weight);
        const sets = parseNumber(exercise.sets);
        const reps = parseNumber(exercise.reps);
        const volume = weight * sets * reps;

        const current = exerciseMap.get(exerciseName) || {
          exerciseName,
          bestWeight: 0,
          bestVolume: 0,
          totalSets: 0,
          totalReps: 0,
          entries: 0,
        };

        exerciseMap.set(exerciseName, {
          exerciseName,
          bestWeight: Math.max(current.bestWeight, weight),
          bestVolume: Math.max(current.bestVolume, volume),
          totalSets: current.totalSets + sets,
          totalReps: current.totalReps + reps,
          entries: current.entries + 1,
        });
      });
    });

    return Array.from(exerciseMap.values()).sort(
      (a, b) => b.bestVolume - a.bestVolume
    );
  }, [submissions]);

  const totalWorkouts = submissions.length;

  const totalExercises = progressData.reduce(
    (sum, exercise) => sum + exercise.entries,
    0
  );

  const totalVolume = progressData.reduce(
    (sum, exercise) => sum + exercise.bestVolume,
    0
  );

  const strongestLift = progressData[0];

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
            Workout Progress
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            Progress
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
            Track progressive overload, strength improvements, and training
            volume over time.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard title="Workouts" value={`${totalWorkouts}`} />

          <SummaryCard title="Exercise Logs" value={`${totalExercises}`} />

          <SummaryCard title="Best Volume" value={`${totalVolume} lbs`} />

          <SummaryCard
            title="Top Lift"
            value={strongestLift ? strongestLift.exerciseName : "No data yet"}
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Training Improvements
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
            Progressive Overload
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            This page focuses on whether you are improving your weights, reps,
            sets, and total training volume over time.
          </p>
        </div>

        {isLoading ? (
          <p className="rounded-2xl bg-sky-50 p-5 text-sm font-semibold text-slate-600">
            Loading progress...
          </p>
        ) : (
          <div className="space-y-6">
            {statusMessage && (
              <p className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold text-slate-700">
                {statusMessage}
              </p>
            )}

            {progressData.length === 0 ? (
              <p className="rounded-2xl bg-sky-50 p-5 text-sm leading-6 text-slate-600">
                No completed workout data yet. Once you submit workouts, your
                lift progress will appear here.
              </p>
            ) : (
              <div className="space-y-4">
                {progressData.map((item) => (
                  <div
                    key={item.exerciseName}
                    className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          {item.exerciseName}
                        </h3>

                        <p className="mt-1 text-sm font-medium text-slate-500">
                          Logged {item.entries} time
                          {item.entries === 1 ? "" : "s"}
                        </p>
                      </div>

                      <p className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700 ring-1 ring-blue-100">
                        Best: {item.bestWeight || 0} lbs
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MiniStat
                        label="Best Weight"
                        value={`${item.bestWeight || 0} lbs`}
                      />

                      <MiniStat
                        label="Best Volume"
                        value={`${item.bestVolume || 0} lbs`}
                      />

                      <MiniStat
                        label="Total Sets"
                        value={`${item.totalSets}`}
                      />

                      <MiniStat
                        label="Total Reps"
                        value={`${item.totalReps}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </ClientLayout>
  );
}

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2 className="mt-2 line-clamp-2 break-words text-xl font-black leading-tight text-slate-900 sm:text-2xl">
        {value}
      </h2>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-sky-100">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-slate-900 sm:text-base">
        {value}
      </p>
    </div>
  );
}