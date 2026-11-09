import { requireTrainer, supabaseAdmin } from "./_lib/trainer.js";

const TRAINER_NOTE = "Marked complete by your trainer.";

function fromPlanExercise(exercise) {
  return {
    exerciseId: exercise.id,
    exerciseName: exercise.exercise_name || "",
    plannedSets: exercise.sets || "",
    plannedReps: exercise.reps || "",
    plannedWeight: exercise.weight || "",
    plannedRest: exercise.rest || "",
    difficulty: "",
    notes: "",
  };
}

async function loadProgramWorkout(clientUserId, workoutId) {
  const { data: workout, error } = await supabaseAdmin
    .from("client_plan_workouts")
    .select("id, title, week_id, client_plan_exercises(*)")
    .eq("id", workoutId)
    .maybeSingle();

  if (error) return { error: error.message, status: 400 };
  if (!workout) return { error: "Workout not found.", status: 404 };

  const { data: week, error: weekError } = await supabaseAdmin
    .from("client_plan_weeks")
    .select("client_user_id")
    .eq("id", workout.week_id)
    .maybeSingle();

  if (weekError) return { error: weekError.message, status: 400 };

  if (week?.client_user_id !== clientUserId) {
    return { error: "This workout does not belong to this client.", status: 400 };
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("workout_submissions")
    .select("id")
    .eq("client_user_id", clientUserId)
    .eq("workout_id", workoutId)
    .eq("source_type", "program")
    .limit(1)
    .maybeSingle();

  if (existingError) return { error: existingError.message, status: 400 };

  if (existing) {
    return {
      error: "This workout has already been submitted.",
      status: 409,
      submissionId: existing.id,
    };
  }

  return {
    title: workout.title,
    planExercises: [...(workout.client_plan_exercises || [])]
      .sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0))
      .map(fromPlanExercise),
    submission: { workout_id: workoutId, source_type: "program" },
  };
}

async function loadRepeatWorkout(clientUserId, historicalWorkoutId) {
  const { data: workout, error } = await supabaseAdmin
    .from("client_historical_workouts")
    .select("id, title, source, client_user_id")
    .eq("id", historicalWorkoutId)
    .maybeSingle();

  if (error) return { error: error.message, status: 400 };

  if (!workout || workout.client_user_id !== clientUserId) {
    return { error: "Workout not found for this client.", status: 404 };
  }

  return {
    title: `${workout.title} — Repeated`,
    planExercises: [],
    submission: {
      workout_id: null,
      historical_workout_id: historicalWorkoutId,
      source_type:
        workout.source === "session" ? "session_repeat" : "imported_repeat",
    },
  };
}

export default async function handler(req, res) {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const {
      clientUserId,
      workoutId,
      historicalWorkoutId,
      incompleteExerciseIds = [],
    } = req.body || {};

    if (!clientUserId || (!workoutId && !historicalWorkoutId)) {
      return res
        .status(400)
        .json({ error: "clientUserId and a workout are required" });
    }

    const target = workoutId
      ? await loadProgramWorkout(clientUserId, workoutId)
      : await loadRepeatWorkout(clientUserId, historicalWorkoutId);

    if (target.error) {
      return res
        .status(target.status)
        .json({ error: target.error, submissionId: target.submissionId });
    }

    let draftQuery = supabaseAdmin
      .from("workout_drafts")
      .select("id, workout_notes, draft_data, updated_at")
      .eq("client_user_id", clientUserId);

    draftQuery = workoutId
      ? draftQuery.eq("workout_id", workoutId)
      : draftQuery.eq("historical_workout_id", historicalWorkoutId);

    const { data: draft, error: draftError } = await draftQuery.maybeSingle();

    if (draftError) return res.status(400).json({ error: draftError.message });

    const draftExercises = draft?.draft_data?.loggedExercises || [];
    const exercises = draftExercises.length
      ? draftExercises
      : target.planExercises;

    if (exercises.length === 0) {
      return res.status(400).json({ error: "This workout has no exercises." });
    }

    const painReported = !!draft?.draft_data?.painReported;
    const painLevel = Number(draft?.draft_data?.painLevel);
    const hasProgress =
      draftExercises.some((exercise) => exercise.completed) ||
      Object.keys(draft?.draft_data?.completedSetCounts || {}).length > 0;

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from("workout_submissions")
      .insert({
        ...target.submission,
        client_user_id: clientUserId,
        workout_title: target.title,
        notes: [draft?.workout_notes?.trim(), TRAINER_NOTE]
          .filter(Boolean)
          .join("\n\n"),
        // Date it when the client last trained, not when the trainer caught it.
        ...(hasProgress ? { submitted_at: draft.updated_at } : {}),
        pain_reported: painReported,
        pain_location: painReported
          ? draft.draft_data.painLocation?.trim() || null
          : null,
        pain_level:
          painReported && painLevel >= 1 && painLevel <= 10 ? painLevel : null,
        pain_exercise: painReported
          ? draft.draft_data.painExercise?.trim() || null
          : null,
        pain_notes: painReported
          ? draft.draft_data.painNotes?.trim() || null
          : null,
      })
      .select("id")
      .single();

    if (submissionError || !submission) {
      return res.status(400).json({
        error: submissionError?.message || "Could not save the workout.",
      });
    }

    const incomplete = new Set(incompleteExerciseIds);

    const { error: exercisesError } = await supabaseAdmin
      .from("workout_submission_exercises")
      .insert(
        exercises.map((exercise) => ({
          submission_id: submission.id,
          exercise_name: exercise.exerciseName,
          planned_sets: exercise.plannedSets,
          planned_reps: exercise.plannedReps,
          planned_weight: exercise.plannedWeight,
          planned_rest: exercise.plannedRest,
          completed: !incomplete.has(exercise.exerciseId),
          difficulty: exercise.difficulty || "",
          notes: exercise.notes || "",
        }))
      );

    if (exercisesError) {
      await supabaseAdmin
        .from("workout_submissions")
        .delete()
        .eq("id", submission.id);

      return res.status(400).json({
        error: "The workout did not fully save: " + exercisesError.message,
      });
    }

    if (draft) {
      await supabaseAdmin.from("workout_drafts").delete().eq("id", draft.id);
    }

    return res.status(200).json({ success: true, submissionId: submission.id });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Something went wrong while completing the workout." });
  }
}
