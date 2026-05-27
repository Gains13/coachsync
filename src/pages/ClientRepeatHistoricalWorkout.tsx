import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type HistoricalExercise = {
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
  notes: string | null;
  client_historical_workout_exercises: HistoricalExercise[];
};

type LoggedExercise = {
  exerciseName: string;
  section: string;
  plannedSets: string;
  plannedReps: string;
  plannedRest: string;
  plannedWeight: string;
  rawText: string;
  completed: boolean;
  difficulty: string;
  notes: string;
};

export default function ClientRepeatHistoricalWorkout() {
  const { historicalWorkoutId } = useParams();
  const navigate = useNavigate();

  const [workout, setWorkout] = useState<HistoricalWorkout | null>(null);
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadHistoricalWorkout();
  }, [historicalWorkoutId]);

  async function loadHistoricalWorkout() {
    setIsLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be logged in to repeat this workout.");
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

    if (!historicalWorkoutId) {
      setErrorMessage("No historical workout ID was found.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("client_historical_workouts")
      .select(
        `
        id,
        client_user_id,
        title,
        workout_date,
        notes,
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
      .eq("id", historicalWorkoutId)
      .eq("client_user_id", user.id)
      .single();

    if (error || !data) {
      console.error(error);
      setErrorMessage("Could not load this imported workout.");
      setIsLoading(false);
      return;
    }

    const typedWorkout = data as HistoricalWorkout;

    const sortedExercises = [
      ...(typedWorkout.client_historical_workout_exercises || []),
    ].sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0));

    setWorkout({
      ...typedWorkout,
      client_historical_workout_exercises: sortedExercises,
    });

    setLoggedExercises(
      sortedExercises.map((exercise) => ({
        section: exercise.section || "Workout",
        exerciseName:
          exercise.exercise_name || exercise.raw_text || "Imported exercise",
        plannedSets: exercise.sets || "",
        plannedReps: exercise.reps || "",
        plannedRest: exercise.rest || "",
        plannedWeight: exercise.weight || "",
        rawText: exercise.raw_text || "",
        completed: false,
        difficulty: "",
        notes: "",
      }))
    );

    setIsLoading(false);
  }

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

  async function submitRepeatedWorkout() {
    if (!workout) {
      setErrorMessage("No imported workout found.");
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be logged in to submit this workout.");
      setIsSubmitting(false);
      return;
    }

    const { data: submission, error: submissionError } = await supabase
      .from("workout_submissions")
      .insert({
        client_user_id: user.id,
        workout_id: null,
        workout_title: `${workout.title} — Repeated`,
        notes: `Repeated from imported past workout. Original workout date: ${
          workout.workout_date || "not recorded"
        }.`,
      })
      .select()
      .single();

    if (submissionError || !submission) {
      console.error(submissionError);
      setErrorMessage(
        submissionError?.message || "Could not submit repeated workout."
      );
      setIsSubmitting(false);
      return;
    }

    const exerciseRows = loggedExercises.map((exercise) => ({
      submission_id: submission.id,
      exercise_name: `${exercise.section}: ${exercise.exerciseName}`,
      planned_sets: exercise.plannedSets,
      planned_reps: exercise.plannedReps,
      planned_weight: exercise.plannedWeight,
      planned_rest: exercise.plannedRest,
      completed: exercise.completed,
      difficulty: exercise.difficulty,
      notes: exercise.notes || exercise.rawText,
    }));

    const { error: exercisesError } = await supabase
      .from("workout_submission_exercises")
      .insert(exerciseRows);

    if (exercisesError) {
      console.error(exercisesError);
      setErrorMessage(
        "Workout was created, but exercises were not saved: " +
          exercisesError.message
      );
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage("Repeated workout submitted successfully!");

    setTimeout(() => {
      navigate("/client-past-workouts");
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
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Loading imported workout...
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Getting this past workout ready for you to repeat.
          </p>
        </section>
      </ClientLayout>
    );
  }

  if (!workout || !historicalWorkoutId) {
    return (
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Imported workout not found
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Go back to your past workouts and choose another imported workout.
          </p>

          {errorMessage && (
            <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}

          <Link
            to="/client-past-workouts"
            className="mt-5 inline-block rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
          >
            Back to Past Workouts
          </Link>
        </section>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100 sm:text-sm sm:tracking-[0.3em]">
                Repeat Imported Workout
              </p>

              <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
                {workout.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-50 sm:mt-3 sm:text-base">
                Repeat this past workout, check off what you completed, and send
                notes to your trainer.
              </p>
            </div>

            <Link
              to="/client-past-workouts"
              className="w-full rounded-2xl bg-white/15 px-4 py-3 text-center text-sm font-black text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto"
            >
              Back to Past Workouts
            </Link>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8">
          <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-4 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Workout Progress
                </p>

                <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">
                  {completedCount} / {loggedExercises.length} exercises
                  completed
                </h2>
              </div>

              <div className="w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-amber-700 ring-1 ring-amber-100">
                {completionPercent}% complete
              </div>
            </div>

            <div className="mt-5 h-3 rounded-full bg-white">
              <div
                className="h-3 rounded-full bg-amber-500 transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {successMessage && (
        <div className="mb-4 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5 text-center text-sm font-black text-emerald-700 shadow-sm sm:mb-6 sm:rounded-3xl">
          {successMessage} Redirecting back to past workouts...
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-[1.5rem] border border-red-100 bg-red-50 p-5 text-center text-sm font-black text-red-700 shadow-sm sm:mb-6 sm:rounded-3xl">
          {errorMessage}
        </div>
      )}

      <section className="space-y-4 sm:space-y-6">
        {loggedExercises.map((exercise, exerciseIndex) => (
          <div
            key={`${exercise.exerciseName}-${exerciseIndex}`}
            className={`rounded-[1.5rem] border p-4 shadow-sm transition sm:rounded-3xl sm:p-6 ${
              exercise.completed
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-100 bg-white"
            }`}
          >
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">
                    {exercise.section}
                  </span>

                  {exercise.completed && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                      Completed
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                  {exercise.exerciseName}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {exercise.plannedSets || "N/A"} sets x{" "}
                  {exercise.plannedReps || "N/A"} • Weight:{" "}
                  {exercise.plannedWeight || "N/A"} • Rest:{" "}
                  {exercise.plannedRest || "N/A"}
                </p>

                {exercise.rawText && (
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                    Original: {exercise.rawText}
                  </p>
                )}
              </div>
            </div>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                exercise.completed
                  ? "border-emerald-200 bg-white"
                  : "border-amber-100 bg-amber-50"
              }`}
            >
              <input
                type="checkbox"
                checked={exercise.completed}
                onChange={() => toggleCompleted(exerciseIndex)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
                disabled={isSubmitting}
              />

              <span className="text-sm font-black leading-6 text-slate-800 sm:text-base">
                I completed this exercise
              </span>
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Difficulty
                </label>

                <select
                  value={exercise.difficulty}
                  onChange={(event) =>
                    updateDifficulty(exerciseIndex, event.target.value)
                  }
                  disabled={isSubmitting}
                  className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 focus:border-amber-300 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Select difficulty</option>
                  <option value="Easy">Easy</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Hard">Hard</option>
                  <option value="Could not complete">Could not complete</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Notes
                </label>

                <input
                  value={exercise.notes}
                  onChange={(event) =>
                    updateNotes(exerciseIndex, event.target.value)
                  }
                  disabled={isSubmitting}
                  placeholder="Optional note for your trainer"
                  className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-amber-300 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      <button
        onClick={submitRepeatedWorkout}
        disabled={isSubmitting || loggedExercises.length === 0}
        className="mt-6 w-full rounded-2xl bg-amber-500 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-8"
      >
        {isSubmitting ? "Submitting workout..." : "Submit Repeated Workout"}
      </button>
    </ClientLayout>
  );
}