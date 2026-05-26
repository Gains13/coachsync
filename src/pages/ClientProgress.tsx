import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

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
    <PageShell
      title="Workout Progress"
      subtitle="Track progressive overload, strength improvements, and muscle-building volume."
    >
      {isLoading ? (
        <p className="rounded-2xl bg-sky-50 p-5 text-slate-600">
          Loading progress...
        </p>
      ) : (
        <div className="space-y-6">
          {statusMessage && (
            <p className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium text-slate-700">
              {statusMessage}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <ProgressTile title="Completed Workouts" value={`${totalWorkouts}`} />
            <ProgressTile title="Exercise Logs" value={`${totalExercises}`} />
            <ProgressTile title="Best Total Volume" value={`${totalVolume} lbs`} />
            <ProgressTile
              title="Top Lift"
              value={strongestLift ? strongestLift.exerciseName : "No data yet"}
            />
          </div>

          <section className="rounded-3xl border border-sky-100 bg-sky-50 p-5">
            <h2 className="text-xl font-bold text-slate-900">
              Progressive Overload
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This page focuses on whether you are improving your weights,
              reps, sets, and total training volume over time.
            </p>

            {progressData.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-white p-4 text-slate-600">
                No completed workout data yet. Once you submit workouts, your
                lift progress will appear here.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {progressData.map((item) => (
                  <div
                    key={item.exerciseName}
                    className="rounded-2xl border border-sky-100 bg-white p-5"
                  >
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {item.exerciseName}
                        </h3>

                        <p className="text-sm text-slate-500">
                          Logged {item.entries} time
                          {item.entries === 1 ? "" : "s"}
                        </p>
                      </div>

                      <p className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                        Best: {item.bestWeight || 0} lbs
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
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
          </section>
        </div>
      )}
    </PageShell>
  );
}

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : 0;
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

function ProgressTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 break-words text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sky-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}