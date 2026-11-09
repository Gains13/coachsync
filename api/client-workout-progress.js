import { requireTrainer, supabaseAdmin } from "./_lib/trainer.js";

function parseSetCount(value) {
  const parsed = Number.parseInt(String(value || "").match(/\d+/)?.[0] || "", 10);
  return parsed > 0 ? parsed : 1;
}

function toProgressItem(draft, titles, names) {
  const logged = draft.draft_data?.loggedExercises || [];
  const setCounts = draft.draft_data?.completedSetCounts || {};

  const exercises = logged.map((exercise) => {
    const totalSets = parseSetCount(exercise.plannedSets);

    return {
      exerciseId: exercise.exerciseId,
      name: exercise.exerciseName || "Unnamed Exercise",
      section: exercise.section || "",
      completed: !!exercise.completed,
      setsDone: exercise.completed
        ? totalSets
        : Math.min(setCounts[exercise.exerciseId] || 0, totalSets),
      totalSets,
      difficulty: exercise.difficulty || "",
      notes: exercise.notes || "",
    };
  });

  return {
    draftId: draft.id,
    clientUserId: draft.client_user_id,
    clientName: names.get(draft.client_user_id) || "Client",
    workoutId: draft.workout_id,
    historicalWorkoutId: draft.historical_workout_id,
    title:
      titles.get(draft.workout_id || draft.historical_workout_id) || "Workout",
    updatedAt: draft.updated_at,
    painReported: !!draft.draft_data?.painReported,
    workoutNotes: draft.workout_notes || "",
    exercises,
  };
}

export default async function handler(req, res) {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const { clientUserId } = req.body || {};

    let query = supabaseAdmin
      .from("workout_drafts")
      .select(
        "id, client_user_id, workout_id, historical_workout_id, workout_notes, draft_data, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(100);

    if (clientUserId) query = query.eq("client_user_id", clientUserId);

    const { data: drafts, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    const rows = drafts || [];
    const workoutIds = rows.map((row) => row.workout_id).filter(Boolean);
    const historicalIds = rows
      .map((row) => row.historical_workout_id)
      .filter(Boolean);
    const clientIds = [...new Set(rows.map((row) => row.client_user_id))];

    const [workouts, historical, profiles, submitted] = await Promise.all([
      supabaseAdmin
        .from("client_plan_workouts")
        .select("id, title")
        .in("id", workoutIds),
      supabaseAdmin
        .from("client_historical_workouts")
        .select("id, title")
        .in("id", historicalIds),
      supabaseAdmin.from("profiles").select("id, full_name").in("id", clientIds),
      supabaseAdmin
        .from("workout_submissions")
        .select("client_user_id, workout_id")
        .eq("source_type", "program")
        .in("workout_id", workoutIds),
    ]);

    const failed = [workouts, historical, profiles, submitted].find(
      (result) => result.error
    );

    if (failed) return res.status(400).json({ error: failed.error.message });

    const titles = new Map(
      [...workouts.data, ...historical.data].map((row) => [row.id, row.title])
    );
    const names = new Map(profiles.data.map((row) => [row.id, row.full_name]));
    const alreadySubmitted = new Set(
      submitted.data.map((row) => `${row.client_user_id}:${row.workout_id}`)
    );

    const items = rows
      .filter(
        (row) => !alreadySubmitted.has(`${row.client_user_id}:${row.workout_id}`)
      )
      .map((row) => toProgressItem(row, titles, names))
      .filter((item) => item.exercises.length > 0);

    return res.status(200).json({ items });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Something went wrong while loading workout progress." });
  }
}
