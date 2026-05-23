import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type SubmissionExercise = {
  id: string;
  exercise_name: string;
  planned_sets: string;
  planned_reps: string;
  planned_weight: string;
  planned_rest: string;
  completed: boolean;
  difficulty: string;
  notes: string;
};

type SubmittedWorkout = {
  id: string;
  workout_title: string;
  submitted_at: string;
  notes: string;
  workout_submission_exercises: SubmissionExercise[];
};

export default function CompletedWorkout() {
  const { submissionId } = useParams();
  const [workout, setWorkout] = useState<SubmittedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadWorkout() {
      if (!submissionId) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("workout_submissions")
        .select(
          `
          id,
          workout_title,
          submitted_at,
          notes,
          workout_submission_exercises (
            id,
            exercise_name,
            planned_sets,
            planned_reps,
            planned_weight,
            planned_rest,
            completed,
            difficulty,
            notes
          )
        `
        )
        .eq("id", submissionId)
        .single();

      if (error) {
        console.error(error);
        setIsLoading(false);
        return;
      }

      setWorkout(data);
      setIsLoading(false);
    }

    loadWorkout();
  }, [submissionId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            CoachSync
          </p>
          <h1 className="mt-3 text-2xl font-bold">
            Loading completed workout...
          </h1>
          <p className="mt-2 text-slate-500">
            Pulling up your submitted workout details.
          </p>
        </div>
      </main>
    );
  }

  if (!workout) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-bold">Workout not found</h1>

          <p className="mt-2 text-slate-500">
            This completed workout could not be loaded.
          </p>

          <Link
            to="/client"
            className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const completedCount = workout.workout_submission_exercises.filter(
    (exercise) => exercise.completed
  ).length;

  const totalExercises = workout.workout_submission_exercises.length;

  const completionPercent =
    totalExercises > 0
      ? Math.round((completedCount / totalExercises) * 100)
      : 0;

  const submittedDate = new Date(workout.submitted_at).toLocaleString();

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Completed Workout
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  {workout.workout_title}
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Submitted: {submittedDate}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/client-plan"
                  className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
                >
                  Back to My Plan
                </Link>

                <Link
                  to="/client"
                  className="rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
            <SummaryCard
              title="Exercises Completed"
              value={`${completedCount} / ${totalExercises}`}
            />

            <SummaryCard
              title="Completion"
              value={`${completionPercent}%`}
            />

            <SummaryCard
              title="Submitted"
              value={new Date(workout.submitted_at).toLocaleDateString()}
            />
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Workout Completion
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {completedCount} / {totalExercises} exercises completed
              </h2>
            </div>

            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
              {completionPercent}% complete
            </span>
          </div>

          <div className="mt-5 h-3 rounded-full bg-sky-50">
            <div
              className="h-3 rounded-full bg-blue-600"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        <div className="space-y-6">
          {workout.workout_submission_exercises.map((exercise) => (
            <div
              key={exercise.id}
              className={`rounded-3xl border p-6 shadow-sm ${
                exercise.completed
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-red-100 bg-red-50"
              }`}
            >
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {exercise.exercise_name}
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    {exercise.planned_sets} sets x {exercise.planned_reps} reps
                    • Weight: {exercise.planned_weight || "N/A"} • Rest:{" "}
                    {exercise.planned_rest || "N/A"}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                    exercise.completed
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : "bg-red-100 text-red-700 ring-red-200"
                  }`}
                >
                  {exercise.completed ? "Completed" : "Not completed"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoBox
                  label="Difficulty"
                  value={exercise.difficulty || "Not selected"}
                />

                <InfoBox label="Notes" value={exercise.notes || "No notes"} />
              </div>
            </div>
          ))}
        </div>
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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}