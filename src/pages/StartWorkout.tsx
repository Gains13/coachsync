import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type PlanExercise = {
  id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  video_link: string;
  exercise_order: number;
};

type PlanWorkout = {
  id: string;
  title: string;
  client_plan_exercises: PlanExercise[];
};

type LoggedExercise = {
  exerciseName: string;
  plannedSets: string;
  plannedReps: string;
  plannedRest: string;
  plannedWeight: string;
  videoLink: string;
  completed: boolean;
  difficulty: string;
  notes: string;
};

export default function StartWorkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workoutId = searchParams.get("workoutId");

  const [workout, setWorkout] = useState<PlanWorkout | null>(null);
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadWorkout() {
      if (!workoutId) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("client_plan_workouts")
        .select(
          `
          id,
          title,
          client_plan_exercises (
            id,
            exercise_name,
            sets,
            reps,
            weight,
            rest,
            video_link,
            exercise_order
          )
        `
        )
        .eq("id", workoutId)
        .single();

      if (error || !data) {
        console.error(error);
        setIsLoading(false);
        return;
      }

      const sortedExercises = [...data.client_plan_exercises].sort(
        (a, b) => a.exercise_order - b.exercise_order
      );

      setWorkout(data);
      setLoggedExercises(
        sortedExercises.map((exercise) => ({
          exerciseName: exercise.exercise_name,
          plannedSets: exercise.sets,
          plannedReps: exercise.reps,
          plannedRest: exercise.rest,
          plannedWeight: exercise.weight,
          videoLink: exercise.video_link,
          completed: false,
          difficulty: "",
          notes: "",
        }))
      );

      setIsLoading(false);
    }

    loadWorkout();
  }, [workoutId]);

  function toggleCompleted(exerciseIndex: number) {
    setLoggedExercises((currentExercises) =>
      currentExercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;

        return {
          ...exercise,
          completed: !exercise.completed,
        };
      })
    );
  }

  function updateDifficulty(exerciseIndex: number, value: string) {
    setLoggedExercises((currentExercises) =>
      currentExercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;

        return {
          ...exercise,
          difficulty: value,
        };
      })
    );
  }

  function updateNotes(exerciseIndex: number, value: string) {
    setLoggedExercises((currentExercises) =>
      currentExercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;

        return {
          ...exercise,
          notes: value,
        };
      })
    );
  }

  async function submitWorkout() {
    if (!workout) {
      alert("No workout found.");
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("You must be logged in to submit a workout.");
      setIsSubmitting(false);
      return;
    }

    const { data: submission, error: submissionError } = await supabase
      .from("workout_submissions")
      .insert({
        client_user_id: user.id,
        workout_title: workout.title,
        notes: "",
      })
      .select()
      .single();

    if (submissionError || !submission) {
      console.error(submissionError);
      alert("Could not submit workout.");
      setIsSubmitting(false);
      return;
    }

    const exerciseRows = loggedExercises.map((exercise) => ({
      submission_id: submission.id,
      exercise_name: exercise.exerciseName,
      planned_sets: exercise.plannedSets,
      planned_reps: exercise.plannedReps,
      planned_weight: exercise.plannedWeight,
      planned_rest: exercise.plannedRest,
      completed: exercise.completed,
      difficulty: exercise.difficulty,
      notes: exercise.notes,
    }));

    const { error: exercisesError } = await supabase
      .from("workout_submission_exercises")
      .insert(exerciseRows);

    if (exercisesError) {
      console.error(exercisesError);
      alert("Workout was created, but exercises were not saved.");
      setIsSubmitting(false);
      return;
    }

    setLoggedExercises([]);
    setSuccessMessage("Workout submitted successfully!");

    setTimeout(() => {
      navigate("/client");
    }, 900);
  }

  const completedCount = loggedExercises.filter(
    (exercise) => exercise.completed
  ).length;

  const completionPercent =
    loggedExercises.length > 0
      ? Math.round((completedCount / loggedExercises.length) * 100)
      : 0;

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            CoachSync
          </p>
          <h1 className="mt-3 text-2xl font-bold">Loading workout...</h1>
          <p className="mt-2 text-slate-500">
            Getting your assigned workout ready.
          </p>
        </div>
      </main>
    );
  }

  if (!workout || !workoutId) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-bold">Workout not found</h1>

          <p className="mt-2 text-slate-500">
            Go back to your dashboard and start the current workout from My Plan.
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Start Workout
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  {workout.title}
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Check off what you completed, rate the difficulty, and add
                  notes for your trainer.
                </p>
              </div>

              <Link
                to="/client-plan"
                className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
              >
                Back to My Plan
              </Link>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="rounded-3xl border border-sky-100 bg-sky-50 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Workout Progress
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {completedCount} / {loggedExercises.length} exercises
                    completed
                  </h2>
                </div>

                <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-sky-100">
                  {completionPercent}% complete
                </div>
              </div>

              <div className="mt-5 h-3 rounded-full bg-white">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="mb-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-center text-emerald-700 shadow-sm">
            {successMessage} Redirecting back to your dashboard...
          </div>
        )}

        <div className="space-y-6">
          {loggedExercises.map((exercise, exerciseIndex) => (
            <div
              key={`${exercise.exerciseName}-${exerciseIndex}`}
              className={`rounded-3xl border p-6 shadow-sm transition ${
                exercise.completed
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-sky-100 bg-white"
              }`}
            >
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">
                      {exercise.exerciseName}
                    </h2>

                    {exercise.completed && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Completed
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    {exercise.plannedSets} sets x {exercise.plannedReps} reps •
                    Weight: {exercise.plannedWeight || "N/A"} • Rest:{" "}
                    {exercise.plannedRest || "N/A"}
                  </p>
                </div>

                {exercise.videoLink && (
                  <a
                    href={exercise.videoLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Watch Video
                  </a>
                )}
              </div>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${
                  exercise.completed
                    ? "border-emerald-200 bg-white"
                    : "border-sky-100 bg-sky-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={exercise.completed}
                  onChange={() => toggleCompleted(exerciseIndex)}
                  className="h-5 w-5 accent-blue-600"
                  disabled={isSubmitting}
                />

                <span className="font-semibold text-slate-800">
                  I completed this exercise as prescribed
                </span>
              </label>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Difficulty
                  </label>

                  <select
                    value={exercise.difficulty}
                    onChange={(event) =>
                      updateDifficulty(exerciseIndex, event.target.value)
                    }
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select difficulty</option>
                    <option value="Easy">Easy</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Hard">Hard</option>
                    <option value="Could not complete">
                      Could not complete
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Notes
                  </label>

                  <input
                    value={exercise.notes}
                    onChange={(event) =>
                      updateNotes(exerciseIndex, event.target.value)
                    }
                    disabled={isSubmitting}
                    placeholder="Optional note for your trainer"
                    className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={submitWorkout}
          disabled={isSubmitting || loggedExercises.length === 0}
          className="mt-8 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting workout..." : "Submit Workout"}
        </button>
      </section>
    </main>
  );
}