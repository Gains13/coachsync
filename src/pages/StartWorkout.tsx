import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

const SECTION_ORDER = [
  "Warm-Up",
  "Activation / Core / Balance",
  "SAQ / Skill Development",
  "Resistance Training",
  "Cool-Down",
  "Other",
];

type PlanExercise = {
  id: string;
  section: string | null;
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
  exerciseId: string;
  section: string;
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

type WorkoutDraftData = {
  loggedExercises: LoggedExercise[];
};

type WorkoutDraftRow = {
  id: string;
  client_user_id: string;
  workout_id: string;
  workout_notes: string | null;
  draft_data: WorkoutDraftData | null;
  updated_at: string;
};

export default function StartWorkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workoutId = searchParams.get("workoutId");

  const saveTimerRef = useRef<number | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");
  const [workout, setWorkout] = useState<PlanWorkout | null>(null);
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    loadWorkout();

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [workoutId]);

  useEffect(() => {
    if (
      !currentUserId ||
      !workoutId ||
      !draftLoaded ||
      isSubmitting ||
      loggedExercises.length === 0
    ) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveDraftToSupabase();
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    currentUserId,
    workoutId,
    workoutNotes,
    loggedExercises,
    draftLoaded,
    isSubmitting,
  ]);

  async function loadWorkout() {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setDraftLoaded(false);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be logged in to view this workout.");
      setIsLoading(false);
      return;
    }

    setCurrentUserId(user.id);

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

    if (!workoutId) {
      setErrorMessage("No workout ID was found.");
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
          section,
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
      setErrorMessage("Could not load this workout.");
      setIsLoading(false);
      return;
    }

    const sortedExercises = [...(data.client_plan_exercises || [])].sort(
      (a, b) => a.exercise_order - b.exercise_order
    );

    const freshLoggedExercises: LoggedExercise[] = sortedExercises.map(
      (exercise) => ({
        exerciseId: exercise.id,
        section: exercise.section || "Resistance Training",
        exerciseName: exercise.exercise_name || "",
        plannedSets: exercise.sets || "",
        plannedReps: exercise.reps || "",
        plannedRest: exercise.rest || "",
        plannedWeight: exercise.weight || "",
        videoLink: exercise.video_link || "",
        completed: false,
        difficulty: "",
        notes: "",
      })
    );

    setWorkout(data as PlanWorkout);

    const { data: existingDraft, error: draftError } = await supabase
      .from("workout_drafts")
      .select(
        "id, client_user_id, workout_id, workout_notes, draft_data, updated_at"
      )
      .eq("client_user_id", user.id)
      .eq("workout_id", workoutId)
      .maybeSingle();

    if (draftError) {
      console.error(draftError);
      setLoggedExercises(freshLoggedExercises);
    } else if (existingDraft) {
      const draft = existingDraft as WorkoutDraftRow;
      const savedExercises = draft.draft_data?.loggedExercises || [];

      const restoredExercises = freshLoggedExercises.map((freshExercise) => {
        const savedExercise = savedExercises.find(
          (exercise) => exercise.exerciseId === freshExercise.exerciseId
        );

        if (!savedExercise) return freshExercise;

        return {
          ...freshExercise,
          completed: savedExercise.completed,
          difficulty: savedExercise.difficulty || "",
          notes: savedExercise.notes || "",
        };
      });

      setLoggedExercises(restoredExercises);
      setWorkoutNotes(draft.workout_notes || "");
      setDraftSavedAt(draft.updated_at || "");
    } else {
      setLoggedExercises(freshLoggedExercises);
    }

    setDraftLoaded(true);
    setIsLoading(false);
  }

  async function saveDraftToSupabase() {
    if (!currentUserId || !workoutId || loggedExercises.length === 0) return;

    setIsSavingDraft(true);

    const now = new Date().toISOString();

    const { data: existingDraft, error: findError } = await supabase
      .from("workout_drafts")
      .select("id")
      .eq("client_user_id", currentUserId)
      .eq("workout_id", workoutId)
      .maybeSingle();

    if (findError) {
      console.error(findError);
      setErrorMessage("Progress could not auto-save. Check connection.");
      setIsSavingDraft(false);
      return;
    }

    if (existingDraft) {
      const { error: updateError } = await supabase
        .from("workout_drafts")
        .update({
          workout_notes: workoutNotes,
          draft_data: {
            loggedExercises,
          },
          updated_at: now,
        })
        .eq("id", existingDraft.id);

      if (updateError) {
        console.error(updateError);
        setErrorMessage("Progress could not auto-save. Check connection.");
        setIsSavingDraft(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("workout_drafts")
        .insert({
          client_user_id: currentUserId,
          workout_id: workoutId,
          historical_workout_id: null,
          workout_notes: workoutNotes,
          draft_data: {
            loggedExercises,
          },
          updated_at: now,
        });

      if (insertError) {
        console.error(insertError);
        setErrorMessage("Progress could not auto-save. Check connection.");
        setIsSavingDraft(false);
        return;
      }
    }

    setDraftSavedAt(now);
    setIsSavingDraft(false);
  }

  async function clearSavedDraft() {
    if (!currentUserId || !workoutId) return;

    await supabase
      .from("workout_drafts")
      .delete()
      .eq("client_user_id", currentUserId)
      .eq("workout_id", workoutId);

    setDraftSavedAt("");
  }

  async function resetWorkoutProgress() {
    const confirmed = window.confirm(
      "This will clear your saved progress for this workout across your devices. Are you sure?"
    );

    if (!confirmed) return;

    setLoggedExercises((currentExercises) =>
      currentExercises.map((exercise) => ({
        ...exercise,
        completed: false,
        difficulty: "",
        notes: "",
      }))
    );

    setWorkoutNotes("");
    await clearSavedDraft();
    setSuccessMessage("");
    setErrorMessage("Saved progress was cleared.");
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

  async function submitWorkout() {
    if (!workout) {
      setErrorMessage("No workout found.");
      return;
    }

    if (isSubmitting) return;

    if (loggedExercises.length === 0) {
      setErrorMessage("This workout has no exercises to submit.");
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be logged in to submit a workout.");
      setIsSubmitting(false);
      return;
    }

    const { data: existingSubmission, error: existingSubmissionError } =
      await supabase
        .from("workout_submissions")
        .select("id")
        .eq("client_user_id", user.id)
        .eq("workout_id", workout.id)
        .maybeSingle();

    if (existingSubmissionError) {
      console.error(existingSubmissionError);
      setErrorMessage("Could not check if this workout was already submitted.");
      setIsSubmitting(false);
      return;
    }

    if (existingSubmission) {
      await clearSavedDraft();
      navigate(`/workout-history/${existingSubmission.id}`);
      return;
    }

    const { data: submission, error: submissionError } = await supabase
      .from("workout_submissions")
      .insert({
        client_user_id: user.id,
        workout_id: workout.id,
        workout_title: workout.title,
        notes: workoutNotes.trim(),
      })
      .select("id")
      .single();

    if (submissionError || !submission) {
      console.error(submissionError);
      setErrorMessage(submissionError?.message || "Could not submit workout.");
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

      await supabase
        .from("workout_submissions")
        .delete()
        .eq("id", submission.id);

      setErrorMessage(
        "The workout did not fully save. Please try again. Details: " +
          exercisesError.message
      );
      setIsSubmitting(false);
      return;
    }

    await clearSavedDraft();

    setSuccessMessage("Workout submitted successfully!");

    setTimeout(() => {
      navigate(`/workout-history/${submission.id}`);
    }, 700);
  }

  const completedCount = loggedExercises.filter(
    (exercise) => exercise.completed
  ).length;

  const completionPercent =
    loggedExercises.length > 0
      ? Math.round((completedCount / loggedExercises.length) * 100)
      : 0;

  const groupedExercises = useMemo(() => {
    return SECTION_ORDER.map((section) => {
      const exercises = loggedExercises
        .map((exercise, originalIndex) => ({
          exercise,
          originalIndex,
        }))
        .filter((item) => item.exercise.section === section);

      return {
        section,
        exercises,
      };
    }).filter((group) => group.exercises.length > 0);
  }, [loggedExercises]);

  const lastSavedLabel = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  if (isLoading) {
    return (
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Loading workout...
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Getting your assigned workout ready.
          </p>
        </section>
      </ClientLayout>
    );
  }

  if (!workout || !workoutId) {
    return (
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Workout not found
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Go back to your dashboard and start the current workout from My Plan.
          </p>

          {errorMessage && (
            <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}

          <Link
            to="/client-plan"
            className="mt-5 inline-block rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
          >
            Back to My Plan
          </Link>
        </section>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                Start Workout
              </p>

              <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
                {workout.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
                Your progress saves automatically across devices.
              </p>
            </div>

            <Link
              to="/client-plan"
              className="w-full rounded-2xl bg-white/15 px-4 py-3 text-center text-sm font-black text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto"
            >
              Back to My Plan
            </Link>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8">
          <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50 p-4 sm:rounded-3xl sm:p-6">
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

              <div className="w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-blue-700 ring-1 ring-sky-100">
                {completionPercent}% complete
              </div>
            </div>

            <div className="mt-5 h-3 rounded-full bg-white">
              <div
                className="h-3 rounded-full bg-blue-600 transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-slate-600">
                {isSavingDraft
                  ? "Saving progress..."
                  : lastSavedLabel
                  ? `Progress saved across devices at ${lastSavedLabel}.`
                  : "Progress will save automatically as you make changes."}
              </p>

              <button
                type="button"
                onClick={resetWorkoutProgress}
                disabled={isSubmitting}
                className="rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear Saved Progress
              </button>
            </div>
          </div>
        </div>
      </section>

      {successMessage && (
        <div className="mb-4 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5 text-center text-sm font-black text-emerald-700 shadow-sm sm:mb-6 sm:rounded-3xl">
          {successMessage} Opening your completed workout...
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-[1.5rem] border border-red-100 bg-red-50 p-5 text-center text-sm font-black text-red-700 shadow-sm sm:mb-6 sm:rounded-3xl">
          {errorMessage}
        </div>
      )}

      <section className="mb-4 rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-6">
        <label className="mb-2 block text-sm font-black text-slate-700">
          Overall Workout Notes
        </label>

        <textarea
          value={workoutNotes}
          onChange={(event) => setWorkoutNotes(event.target.value)}
          disabled={isSubmitting}
          placeholder="Optional notes about the whole workout"
          rows={3}
          className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </section>

      <section className="space-y-5 sm:space-y-6">
        {groupedExercises.map((group) => (
          <div
            key={group.section}
            className="rounded-[1.5rem] border border-sky-100 bg-sky-50 p-4 shadow-sm sm:rounded-3xl sm:p-5"
          >
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Section
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900">
                {group.section}
              </h2>
            </div>

            <div className="space-y-4">
              {group.exercises.map(({ exercise, originalIndex }) => (
                <div
                  key={`${exercise.exerciseId}-${originalIndex}`}
                  className={`rounded-[1.5rem] border p-4 shadow-sm transition sm:rounded-3xl sm:p-6 ${
                    exercise.completed
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-sky-100 bg-white"
                  }`}
                >
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-black text-slate-900 sm:text-xl">
                          {exercise.exerciseName}
                        </h3>

                        {exercise.completed && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                            Completed
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {exercise.plannedSets || "N/A"} sets x{" "}
                        {exercise.plannedReps || "N/A"} reps • Weight:{" "}
                        {exercise.plannedWeight || "N/A"} • Rest:{" "}
                        {exercise.plannedRest || "N/A"}
                      </p>
                    </div>

                    {exercise.videoLink && (
                      <a
                        href={exercise.videoLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white shadow-sm hover:bg-blue-700 sm:w-auto"
                      >
                        Watch Video
                      </a>
                    )}
                  </div>

                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                      exercise.completed
                        ? "border-emerald-200 bg-white"
                        : "border-sky-100 bg-sky-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={exercise.completed}
                      onChange={() => toggleCompleted(originalIndex)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"
                      disabled={isSubmitting}
                    />

                    <span className="text-sm font-black leading-6 text-slate-800 sm:text-base">
                      I completed this exercise as prescribed
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
                          updateDifficulty(originalIndex, event.target.value)
                        }
                        disabled={isSubmitting}
                        className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                      <label className="mb-2 block text-sm font-black text-slate-700">
                        Notes
                      </label>

                      <input
                        value={exercise.notes}
                        onChange={(event) =>
                          updateNotes(originalIndex, event.target.value)
                        }
                        disabled={isSubmitting}
                        placeholder="Optional note for your trainer"
                        className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={submitWorkout}
        disabled={isSubmitting || loggedExercises.length === 0}
        className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-8"
      >
        {isSubmitting ? "Submitting workout..." : "Submit Workout"}
      </button>
    </ClientLayout>
  );
}