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
  workout_id: string | null;
  workout_title: string;
  submitted_at: string;
  notes: string;
  workout_submission_exercises: SubmissionExercise[];
};

export default function CompletedWorkout() {
  const { submissionId } = useParams();

  const [workout, setWorkout] = useState<SubmittedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadWorkout();
  }, [submissionId]);

  async function loadWorkout() {
    setIsLoading(true);
    setStatusMessage("");

    if (!submissionId) {
      setStatusMessage("No workout submission ID was found.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("workout_submissions")
      .select(
        `
        id,
        workout_id,
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

    if (error || !data) {
      console.error(error);
      setStatusMessage(
        error?.message || "This completed workout could not be loaded."
      );
      setIsLoading(false);
      return;
    }

    setWorkout(data as SubmittedWorkout);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
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
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-bold">Workout not found</h1>

          <p className="mt-2 text-slate-500">
            This completed workout could not be loaded.
          </p>

          {statusMessage && (
            <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
              {statusMessage}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/client-plan"
              className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 sm:py-2"
            >
              Back to My Plan
            </Link>

            <Link
              to="/client"
              className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-600 hover:bg-sky-50 sm:py-2"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const exercises = workout.workout_submission_exercises || [];

  const completedCount = exercises.filter((exercise) => exercise.completed).length;
  const totalExercises = exercises.length;

  const incompleteCount = totalExercises - completedCount;

  const completionPercent =
    totalExercises > 0
      ? Math.round((completedCount / totalExercises) * 100)
      : 0;

  const submittedDate = new Date(workout.submitted_at).toLocaleString();
  const submittedShortDate = new Date(workout.submitted_at).toLocaleDateString();

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Completed Workout
                </p>

                <h1 className="mt-3 break-words text-3xl font-bold md:text-4xl">
                  {workout.workout_title}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Submitted: {submittedDate}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/client-plan"
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Back to My Plan
                </Link>

                <Link
                  to="/client"
                  className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:py-2"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-4 md:p-8">
            <SummaryCard
              title="Exercises Completed"
              value={`${completedCount} / ${totalExercises}`}
            />

            <SummaryCard title="Completion" value={`${completionPercent}%`} />

            <SummaryCard title="Incomplete" value={`${incompleteCount}`} />

            <SummaryCard title="Submitted" value={submittedShortDate} />
          </div>
        </div>

        {statusMessage && (
          <p className="mb-6 rounded-2xl border border-sky-100 bg-white p-4 text-sm font-medium leading-6 text-slate-700 shadow-sm">
            {statusMessage}
          </p>
        )}

        <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Workout Completion
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {completedCount} / {totalExercises} exercises completed
              </h2>
            </div>

            <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
              {completionPercent}% complete
            </span>
          </div>

          <div className="mt-5 h-3 rounded-full bg-sky-50">
            <div
              className="h-3 rounded-full bg-blue-600 transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {workout.notes && (
            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <p className="text-sm font-medium text-slate-500">
                Workout Notes
              </p>

              <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-800">
                {workout.notes}
              </p>
            </div>
          )}
        </div>

        {exercises.length === 0 ? (
          <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              No exercise details found
            </h2>

            <p className="mt-2 text-slate-500">
              This workout was submitted, but no exercise rows were saved.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {exercises.map((exercise, index) => (
              <div
                key={exercise.id}
                className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
                  exercise.completed
                    ? "border-emerald-100 bg-emerald-50"
                    : "border-red-100 bg-red-50"
                }`}
              >
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Exercise {index + 1}
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-slate-900">
                      {exercise.exercise_name}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {exercise.planned_sets || "N/A"} sets x{" "}
                      {exercise.planned_reps || "N/A"} reps • Weight:{" "}
                      {exercise.planned_weight || "N/A"} • Rest:{" "}
                      {exercise.planned_rest || "N/A"}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                      exercise.completed
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                        : "bg-red-100 text-red-700 ring-red-200"
                    }`}
                  >
                    {exercise.completed ? "Completed" : "Not Completed"}
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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-1 whitespace-pre-wrap break-words font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}