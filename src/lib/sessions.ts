import { supabase } from "./supabaseClient";

// In-person sessions are stored in client_historical_workouts with
// source = "session". Imported notes live in the same table.
export const SESSION_SOURCE = "session";

export const SESSION_SECTIONS = [
  "Warm-up",
  "Activation",
  "Resistance",
  "Conditioning",
  "Cool-down",
] as const;

export type LoggedSet = {
  weight: string;
  reps: string;
  done: boolean;
};

export type SessionExercise = {
  key: string;
  section: string;
  exerciseName: string;
  rest: string;
  notes: string;
  sets: LoggedSet[];
};

export type SessionStatus = "draft" | "completed";

export type Session = {
  id: string;
  clientUserId: string;
  title: string;
  workoutDate: string;
  notes: string;
  status: SessionStatus;
  exercises: SessionExercise[];
};

type SessionExerciseRow = {
  id: string;
  section: string | null;
  exercise_name: string | null;
  sets: string | null;
  reps: string | null;
  weight: string | null;
  rest: string | null;
  notes: string | null;
  logged_sets: LoggedSet[] | null;
  exercise_order: number | null;
};

type SessionRow = {
  id: string;
  client_user_id: string;
  title: string | null;
  workout_date: string | null;
  notes: string | null;
  status: SessionStatus | null;
  client_historical_workout_exercises: SessionExerciseRow[] | null;
};

const SESSION_SELECT = `
  id,
  client_user_id,
  title,
  workout_date,
  notes,
  status,
  client_historical_workout_exercises (
    id,
    section,
    exercise_name,
    sets,
    reps,
    weight,
    rest,
    notes,
    logged_sets,
    exercise_order
  )
`;

export function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

export function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function emptySet(previous?: LoggedSet): LoggedSet {
  return {
    weight: previous?.weight || "",
    reps: previous?.reps || "",
    done: false,
  };
}

export function newExercise(section = "Resistance", exerciseName = ""): SessionExercise {
  return {
    key: newKey(),
    section,
    exerciseName,
    rest: "",
    notes: "",
    sets: [emptySet()],
  };
}

function rowToExercise(row: SessionExerciseRow): SessionExercise {
  const logged = Array.isArray(row.logged_sets) ? row.logged_sets : [];

  // Imported notes have no per-set data: expand their "3 x 10 @ 30" summary.
  const fallbackCount = Math.max(1, Number.parseInt(row.sets || "", 10) || 1);
  const sets =
    logged.length > 0
      ? logged.map((set) => ({
          weight: set.weight || "",
          reps: set.reps || "",
          done: !!set.done,
        }))
      : Array.from({ length: fallbackCount }, () => ({
          weight: row.weight || "",
          reps: row.reps || "",
          done: false,
        }));

  return {
    key: row.id || newKey(),
    section: row.section || "Resistance",
    exerciseName: row.exercise_name || "",
    rest: row.rest || "",
    notes: row.notes || "",
    sets,
  };
}

function rowToSession(row: SessionRow): Session {
  const exercises = [...(row.client_historical_workout_exercises || [])]
    .sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0))
    .map(rowToExercise);

  return {
    id: row.id,
    clientUserId: row.client_user_id,
    title: row.title || "",
    workoutDate: row.workout_date || todayIsoDate(),
    notes: row.notes || "",
    status: row.status === "draft" ? "draft" : "completed",
    exercises,
  };
}

// Plain-text summary columns keep the existing client pages (which read
// sets/reps/weight) working for sessions too.
function summarize(exercise: SessionExercise) {
  const sets = exercise.sets;
  const reps = Array.from(new Set(sets.map((set) => set.reps.trim()).filter(Boolean)));
  const weights = Array.from(new Set(sets.map((set) => set.weight.trim()).filter(Boolean)));

  return {
    sets: String(sets.length),
    reps: reps.join(" / "),
    weight: weights.join(" / "),
  };
}

export async function loadSession(sessionId: string) {
  const { data, error } = await supabase
    .from("client_historical_workouts")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    return { session: null, error: error?.message || "Session not found." };
  }

  return { session: rowToSession(data as unknown as SessionRow), error: "" };
}

export async function loadLatestSessionForClient(clientUserId: string) {
  const { data, error } = await supabase
    .from("client_historical_workouts")
    .select(SESSION_SELECT)
    .eq("client_user_id", clientUserId)
    .eq("source", SESSION_SOURCE)
    .eq("status", "completed")
    .order("workout_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return rowToSession(data as unknown as SessionRow);
}

export async function createSession({
  clientUserId,
  trainerUserId,
  title,
  copyFrom,
}: {
  clientUserId: string;
  trainerUserId: string;
  title: string;
  copyFrom?: Session | null;
}) {
  const { data, error } = await supabase
    .from("client_historical_workouts")
    .insert({
      client_user_id: clientUserId,
      trainer_user_id: trainerUserId,
      title,
      workout_date: todayIsoDate(),
      source: SESSION_SOURCE,
      status: "draft",
      notes: "",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { sessionId: null, error: error?.message || "Could not start session." };
  }

  if (copyFrom && copyFrom.exercises.length > 0) {
    // Start from last time's weights and reps, with every set un-ticked.
    const exercises = copyFrom.exercises.map((exercise) => ({
      ...exercise,
      key: newKey(),
      notes: "",
      sets: exercise.sets.map((set) => ({ ...set, done: false })),
    }));

    const saveError = await saveSessionExercises(data.id, exercises);
    if (saveError) return { sessionId: data.id as string, error: saveError };
  }

  return { sessionId: data.id as string, error: "" };
}

async function saveSessionExercises(sessionId: string, exercises: SessionExercise[]) {
  const { error: deleteError } = await supabase
    .from("client_historical_workout_exercises")
    .delete()
    .eq("historical_workout_id", sessionId);

  if (deleteError) return deleteError.message;

  const rows = exercises
    .filter((exercise) => exercise.exerciseName.trim() !== "")
    .map((exercise, index) => ({
      historical_workout_id: sessionId,
      section: exercise.section,
      exercise_name: exercise.exerciseName.trim(),
      rest: exercise.rest.trim(),
      notes: exercise.notes.trim(),
      logged_sets: exercise.sets,
      raw_text: null,
      exercise_order: index + 1,
      ...summarize(exercise),
    }));

  if (rows.length === 0) return "";

  const { error } = await supabase
    .from("client_historical_workout_exercises")
    .insert(rows);

  return error?.message || "";
}

export async function saveSession(session: Session) {
  const { error } = await supabase
    .from("client_historical_workouts")
    .update({
      title: session.title.trim() || "Training session",
      workout_date: session.workoutDate,
      notes: session.notes,
      status: session.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (error) return error.message;

  return saveSessionExercises(session.id, session.exercises);
}

export async function deleteSession(sessionId: string) {
  const { error: exercisesError } = await supabase
    .from("client_historical_workout_exercises")
    .delete()
    .eq("historical_workout_id", sessionId);

  if (exercisesError) return exercisesError.message;

  const { error } = await supabase
    .from("client_historical_workouts")
    .delete()
    .eq("id", sessionId);

  return error?.message || "";
}

export function startOfWeek(date = new Date()) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}
