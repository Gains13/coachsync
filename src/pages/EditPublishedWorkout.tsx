import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../lib/supabaseClient";

const WORKOUT_SECTIONS = [
  "Warm-Up",
  "Activation / Core / Balance",
  "SAQ / Skill Development",
  "Resistance Training",
  "Cool-Down",
  "Other",
];

const SECTION_DESCRIPTIONS: Record<string, string> = {
  "Warm-Up": "Prepare the body, increase temperature, and set movement quality.",
  "Activation / Core / Balance":
    "Core control, stability, balance, and activation work.",
  "SAQ / Skill Development":
    "Speed, agility, quickness, reaction, coordination, or sport skill work.",
  "Resistance Training":
    "Main strength, stability, hypertrophy, or machine work.",
  "Cool-Down": "Recovery, mobility, stretching, breathing, and reset work.",
  Other: "Any additional coaching work that does not fit the main sections.",
};

type WorkoutRow = {
  id: string;
  title: string;
  workout_order: number;
  week_id: string;
  client_plan_weeks?: {
    id: string;
    week_number: number;
    status: string;
    client_user_id: string;
    profiles?: {
      full_name: string;
      client_id: string;
    } | null;
  } | null;
};

type ExerciseRow = {
  id: string;
  workout_id: string;
  section: string | null;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  video_link: string;
  trainer_notes: string | null;
  exercise_order: number;
};

type ExerciseForm = {
  formId: string;
  existingId: string | null;
  section: string;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  videoLink: string;
  trainerNotes: string;
  shouldDelete: boolean;
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankExercise(section = "Resistance Training"): ExerciseForm {
  return {
    formId: makeId(),
    existingId: null,
    section,
    exerciseName: "",
    sets: "",
    reps: "",
    weight: "",
    rest: "",
    videoLink: "",
    trainerNotes: "",
    shouldDelete: false,
  };
}

function normalizeSection(section: string | null | undefined) {
  const cleaned = (section || "").trim();

  if (!cleaned) return "Other";

  if (WORKOUT_SECTIONS.includes(cleaned)) return cleaned;

  const lower = cleaned.toLowerCase();

  if (lower === "warmup" || lower === "warm up" || lower === "warm-up") {
    return "Warm-Up";
  }

  if (
    lower === "core activation" ||
    lower === "core and activation" ||
    lower === "activation" ||
    lower === "activation/core/balance" ||
    lower === "activation / core / balance" ||
    lower === "core/balance" ||
    lower === "balance"
  ) {
    return "Activation / Core / Balance";
  }

  if (
    lower === "saq" ||
    lower === "skill development" ||
    lower === "saq / skill development" ||
    lower === "saq/skill development"
  ) {
    return "SAQ / Skill Development";
  }

  if (
    lower === "resistance" ||
    lower === "resistance training" ||
    lower === "strength" ||
    lower === "strength training"
  ) {
    return "Resistance Training";
  }

  if (
    lower === "cooldown" ||
    lower === "cool down" ||
    lower === "cool-down"
  ) {
    return "Cool-Down";
  }

  return "Other";
}

function getExerciseSummary(exercise: ExerciseForm) {
  const parts = [
    exercise.section,
    exercise.sets ? `${exercise.sets} sets` : "",
    exercise.reps || "",
    exercise.weight || "",
    exercise.rest ? `${exercise.rest} rest` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" • ") : "No details added yet";
}

function getPreviewIssues(exercises: ExerciseForm[]) {
  const activeExercises = exercises.filter(
    (exercise) => !exercise.shouldDelete && exercise.exerciseName.trim() !== ""
  );

  return {
    missingSets: activeExercises.filter(
      (exercise) => exercise.sets.trim() === ""
    ).length,
    missingReps: activeExercises.filter(
      (exercise) => exercise.reps.trim() === ""
    ).length,
    missingRest: activeExercises.filter(
      (exercise) => exercise.rest.trim() === ""
    ).length,
    missingVideo: activeExercises.filter(
      (exercise) => exercise.videoLink.trim() === ""
    ).length,
    missingNotes: activeExercises.filter(
      (exercise) => exercise.trainerNotes.trim() === ""
    ).length,
  };
}

export default function EditPublishedWorkout() {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const saveTimerRef = useRef<number | null>(null);

  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [workoutTitle, setWorkoutTitle] = useState("");
  const [workoutOrder, setWorkoutOrder] = useState("1");
  const [exercises, setExercises] = useState<ExerciseForm[]>([]);
  const [originalExerciseIds, setOriginalExerciseIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadWorkout();

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [workoutId]);

  useEffect(() => {
    if (!workoutId || isLoading || isSaving || !workout) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveLocalDraft();
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [workoutId, workoutTitle, workoutOrder, exercises, isLoading, isSaving]);

  const visibleExercises = exercises.filter((exercise) => !exercise.shouldDelete);

  const groupedExercises = useMemo(() => {
    return WORKOUT_SECTIONS.map((section) => {
      const sectionExercises = visibleExercises
        .map((exercise, originalIndex) => ({
          exercise,
          originalIndex,
        }))
        .filter((item) => item.exercise.section === section);

      return {
        section,
        exercises: sectionExercises,
      };
    });
  }, [visibleExercises]);

  const totalActiveExercises = visibleExercises.filter(
    (exercise) => exercise.exerciseName.trim() !== ""
  ).length;

  const previewIssues = getPreviewIssues(exercises);

  async function loadWorkout() {
    setIsLoading(true);
    setStatusMessage("");
    setErrorMessage("");

    if (!workoutId) {
      setErrorMessage("No workout ID was found.");
      setIsLoading(false);
      return;
    }

    const { data: workoutData, error: workoutError } = await supabase
      .from("client_plan_workouts")
      .select(
        `
        id,
        title,
        workout_order,
        week_id,
        client_plan_weeks (
          id,
          week_number,
          status,
          client_user_id,
          profiles (
            full_name,
            client_id
          )
        )
      `
      )
      .eq("id", workoutId)
      .maybeSingle();

    if (workoutError || !workoutData) {
      console.error(workoutError);
      setErrorMessage(
        workoutError?.message || "Could not load this published workout."
      );
      setIsLoading(false);
      return;
    }

    const { data: exerciseData, error: exerciseError } = await supabase
      .from("client_plan_exercises")
      .select(
        "id, workout_id, section, exercise_name, sets, reps, weight, rest, video_link, trainer_notes, exercise_order"
      )
      .eq("workout_id", workoutId)
      .order("exercise_order", { ascending: true });

    if (exerciseError) {
      console.error(exerciseError);
      setErrorMessage("Could not load workout exercises: " + exerciseError.message);
      setIsLoading(false);
      return;
    }

const loadedWorkout = workoutData as unknown as WorkoutRow;
const loadedExercises = (exerciseData || []) as unknown as ExerciseRow[];

    setWorkout(loadedWorkout);
    setWorkoutTitle(loadedWorkout.title || "");
    setWorkoutOrder(String(loadedWorkout.workout_order || 1));
    setOriginalExerciseIds(loadedExercises.map((exercise) => exercise.id));

    const savedDraft = loadLocalDraft(workoutId);

    if (savedDraft) {
      const confirmed = window.confirm(
        "A saved editing draft was found for this workout. Restore it?"
      );

      if (confirmed) {
        setWorkoutTitle(savedDraft.workoutTitle || loadedWorkout.title || "");
        setWorkoutOrder(
          savedDraft.workoutOrder || String(loadedWorkout.workout_order || 1)
        );
        setExercises(
          savedDraft.exercises && savedDraft.exercises.length > 0
            ? savedDraft.exercises
            : loadedExercisesToForm(loadedExercises)
        );
        setDraftSavedAt(savedDraft.savedAt || "");
        setStatusMessage("Draft restored.");
        setIsLoading(false);
        return;
      }

      clearLocalDraft(workoutId);
    }

    setExercises(loadedExercisesToForm(loadedExercises));
    setIsLoading(false);
  }

  function loadedExercisesToForm(loadedExercises: ExerciseRow[]): ExerciseForm[] {
    if (loadedExercises.length === 0) {
      return [blankExercise()];
    }

    return loadedExercises.map((exercise) => ({
      formId: makeId(),
      existingId: exercise.id,
      section: normalizeSection(exercise.section),
      exerciseName: exercise.exercise_name || "",
      sets: exercise.sets || "",
      reps: exercise.reps || "",
      weight: exercise.weight || "",
      rest: exercise.rest || "",
      videoLink: exercise.video_link || "",
      trainerNotes: exercise.trainer_notes || "",
      shouldDelete: false,
    }));
  }

  function getDraftKey(id: string) {
    return `coachsync-edit-workout-draft-${id}`;
  }

  function loadLocalDraft(id: string) {
    try {
      const rawDraft = localStorage.getItem(getDraftKey(id));

      if (!rawDraft) return null;

      return JSON.parse(rawDraft) as {
        workoutTitle: string;
        workoutOrder: string;
        exercises: ExerciseForm[];
        savedAt: string;
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function saveLocalDraft() {
    if (!workoutId) return;

    setIsAutosaving(true);

    const now = new Date().toISOString();

    localStorage.setItem(
      getDraftKey(workoutId),
      JSON.stringify({
        workoutTitle,
        workoutOrder,
        exercises,
        savedAt: now,
      })
    );

    setDraftSavedAt(now);
    setIsAutosaving(false);
  }

  function clearLocalDraft(id = workoutId || "") {
    if (!id) return;

    localStorage.removeItem(getDraftKey(id));
    setDraftSavedAt("");
  }

  function updateExercise(
    formId: string,
    field: keyof ExerciseForm,
    value: string | boolean
  ) {
    setExercises((currentExercises) =>
      currentExercises.map((exercise) => {
        if (exercise.formId !== formId) return exercise;

        return {
          ...exercise,
          [field]: value,
        };
      })
    );
  }

  function addExercise(section = "Resistance Training") {
    setExercises((currentExercises) => [
      ...currentExercises,
      blankExercise(section),
    ]);
  }

  function duplicateExercise(formId: string) {
    const exerciseToDuplicate = exercises.find(
      (exercise) => exercise.formId === formId
    );

    if (!exerciseToDuplicate) return;

    const duplicatedExercise: ExerciseForm = {
      ...exerciseToDuplicate,
      formId: makeId(),
      existingId: null,
      exerciseName: exerciseToDuplicate.exerciseName
        ? `${exerciseToDuplicate.exerciseName} Copy`
        : "",
      shouldDelete: false,
    };

    setExercises((currentExercises) => {
      const index = currentExercises.findIndex(
        (exercise) => exercise.formId === formId
      );

      if (index === -1) return [...currentExercises, duplicatedExercise];

      return [
        ...currentExercises.slice(0, index + 1),
        duplicatedExercise,
        ...currentExercises.slice(index + 1),
      ];
    });
  }

  function removeExercise(formId: string) {
    const exerciseToRemove = exercises.find(
      (exercise) => exercise.formId === formId
    );

    if (!exerciseToRemove) return;

    const confirmed = window.confirm(
      `Remove "${exerciseToRemove.exerciseName || "this exercise"}"?`
    );

    if (!confirmed) return;

    if (exerciseToRemove.existingId) {
      setExercises((currentExercises) =>
        currentExercises.map((exercise) => {
          if (exercise.formId !== formId) return exercise;

          return {
            ...exercise,
            shouldDelete: true,
          };
        })
      );
      return;
    }

    setExercises((currentExercises) =>
      currentExercises.filter((exercise) => exercise.formId !== formId)
    );
  }

  function restoreExercise(formId: string) {
    setExercises((currentExercises) =>
      currentExercises.map((exercise) => {
        if (exercise.formId !== formId) return exercise;

        return {
          ...exercise,
          shouldDelete: false,
        };
      })
    );
  }

  function moveExercise(formId: string, direction: "up" | "down") {
    setExercises((currentExercises) => {
      const visibleIds = currentExercises
        .filter((exercise) => !exercise.shouldDelete)
        .map((exercise) => exercise.formId);

      const currentVisibleIndex = visibleIds.indexOf(formId);

      if (currentVisibleIndex === -1) return currentExercises;

      const targetVisibleIndex =
        direction === "up" ? currentVisibleIndex - 1 : currentVisibleIndex + 1;

      if (targetVisibleIndex < 0 || targetVisibleIndex >= visibleIds.length) {
        return currentExercises;
      }

      const activeId = visibleIds[currentVisibleIndex];
      const targetId = visibleIds[targetVisibleIndex];

      const oldIndex = currentExercises.findIndex(
        (exercise) => exercise.formId === activeId
      );

      const newIndex = currentExercises.findIndex(
        (exercise) => exercise.formId === targetId
      );

      if (oldIndex === -1 || newIndex === -1) return currentExercises;

      return arrayMove(currentExercises, oldIndex, newIndex);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setExercises((currentExercises) => {
      const oldIndex = currentExercises.findIndex(
        (exercise) => exercise.formId === active.id
      );

      const newIndex = currentExercises.findIndex(
        (exercise) => exercise.formId === over.id
      );

      if (oldIndex === -1 || newIndex === -1) return currentExercises;

      return arrayMove(currentExercises, oldIndex, newIndex);
    });
  }

  async function saveWorkoutChanges() {
    if (!workoutId || !workout) return;

    if (!workoutTitle.trim()) {
      setErrorMessage("Workout title cannot be empty.");
      return;
    }

    const exercisesToSave = exercises.filter(
      (exercise) => !exercise.shouldDelete && exercise.exerciseName.trim() !== ""
    );

    if (exercisesToSave.length === 0) {
      setErrorMessage("This workout needs at least one exercise.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving published workout changes...");
    setErrorMessage("");

    const { error: workoutUpdateError } = await supabase
      .from("client_plan_workouts")
      .update({
        title: workoutTitle.trim(),
        workout_order: Number(workoutOrder) || 1,
      })
      .eq("id", workoutId);

    if (workoutUpdateError) {
      console.error(workoutUpdateError);
      setErrorMessage("Could not update workout: " + workoutUpdateError.message);
      setIsSaving(false);
      return;
    }

    const idsStillPresent = exercisesToSave
      .map((exercise) => exercise.existingId)
      .filter(Boolean) as string[];

    const idsToDelete = originalExerciseIds.filter(
      (exerciseId) => !idsStillPresent.includes(exerciseId)
    );

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("client_plan_exercises")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        console.error(deleteError);
        setErrorMessage("Could not delete removed exercises: " + deleteError.message);
        setIsSaving(false);
        return;
      }
    }

    for (let index = 0; index < exercisesToSave.length; index++) {
      const exercise = exercisesToSave[index];

      const exercisePayload = {
        workout_id: workoutId,
        section: exercise.section,
        exercise_name: exercise.exerciseName.trim(),
        sets: exercise.sets.trim(),
        reps: exercise.reps.trim(),
        weight: exercise.weight.trim(),
        rest: exercise.rest.trim(),
        video_link: exercise.videoLink.trim(),
        trainer_notes: exercise.trainerNotes.trim(),
        exercise_order: index + 1,
      };

      if (exercise.existingId) {
        const { error: updateExerciseError } = await supabase
          .from("client_plan_exercises")
          .update(exercisePayload)
          .eq("id", exercise.existingId);

        if (updateExerciseError) {
          console.error(updateExerciseError);
          setErrorMessage(
            `Could not update exercise "${exercise.exerciseName}": ` +
              updateExerciseError.message
          );
          setIsSaving(false);
          return;
        }
      } else {
        const { error: insertExerciseError } = await supabase
          .from("client_plan_exercises")
          .insert(exercisePayload);

        if (insertExerciseError) {
          console.error(insertExerciseError);
          setErrorMessage(
            `Could not add exercise "${exercise.exerciseName}": ` +
              insertExerciseError.message
          );
          setIsSaving(false);
          return;
        }
      }
    }

    clearLocalDraft();
    setStatusMessage("Published workout updated successfully.");
    setIsSaving(false);

    setTimeout(() => {
      navigate(`/clients/${workout.client_plan_weeks?.client_user_id || ""}`);
    }, 700);
  }

  async function discardLocalChanges() {
    const confirmed = window.confirm(
      "Discard your unsaved edits and reload the published version?"
    );

    if (!confirmed) return;

    clearLocalDraft();
    await loadWorkout();
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
        <section className="mx-auto max-w-4xl rounded-[2rem] border border-sky-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Loading workout editor...
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Pulling the published workout from Supabase.
          </p>
        </section>
      </main>
    );
  }

  if (!workout) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
        <section className="mx-auto max-w-4xl rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-600">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Workout not found
          </h1>

          {errorMessage && (
            <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          )}

          <Link
            to="/clients"
            className="mt-5 inline-block rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
          >
            Back to Clients
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-6 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-8 sm:rounded-[2rem]">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-600 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Edit Published Workout
                </p>

                <h1 className="mt-3 break-words text-3xl font-black leading-tight md:text-5xl">
                  {workoutTitle || "Untitled Workout"}
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-blue-50 sm:text-base">
                  Week {workout.client_plan_weeks?.week_number || "?"} •{" "}
                  {workout.client_plan_weeks?.profiles?.full_name ||
                    "Unknown Client"}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to={`/clients/${workout.client_plan_weeks?.client_user_id || ""}`}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:w-auto"
                >
                  Back to Client
                </Link>

                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="w-full rounded-2xl bg-white/15 px-4 py-3 text-sm font-black text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto"
                >
                  Preview
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:p-6 md:grid-cols-4 md:p-8">
            <SummaryCard title="Exercises" value={String(totalActiveExercises)} />
            <SummaryCard
              title="Sections"
              value={String(
                groupedExercises.filter((group) => group.exercises.length > 0)
                  .length
              )}
            />
            <SummaryCard
              title="Autosave"
              value={
                isAutosaving
                  ? "Saving"
                  : draftSavedAt
                  ? "Saved"
                  : "Ready"
              }
            />
            <SummaryCard title="Mode" value="Published" />
          </div>
        </div>

        {statusMessage && (
          <p className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold leading-6 text-slate-700">
            {statusMessage}
          </p>
        )}

        {errorMessage && (
          <p className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
            {errorMessage}
          </p>
        )}

        <section className="mb-6 rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              Workout Details
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-900">
              Edit title and order
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Workout Title"
              value={workoutTitle}
              onChange={setWorkoutTitle}
              placeholder="Day 1 Stabilization Endurance"
            />

            <Input
              label="Workout Order"
              value={workoutOrder}
              onChange={setWorkoutOrder}
              placeholder="1"
              type="number"
            />
          </div>

          <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
            {draftSavedAt
              ? `Editing draft saved at ${new Date(draftSavedAt).toLocaleTimeString(
                  [],
                  {
                    hour: "numeric",
                    minute: "2-digit",
                  }
                )}.`
              : "Changes are autosaved locally while editing."}
          </p>
        </section>

        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Exercises
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Edit guided workout flow
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Update sections, exercises, sets, reps, rest, video links, and
                trainer notes. This changes what the client sees in guided mode.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {WORKOUT_SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => addExercise(section)}
                  className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                >
                  + {section}
                </button>
              ))}
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleExercises.map((exercise) => exercise.formId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-5">
                {WORKOUT_SECTIONS.map((section) => {
                  const sectionExercises = groupedExercises.find(
                    (group) => group.section === section
                  )?.exercises;

                  if (!sectionExercises || sectionExercises.length === 0) {
                    return (
                      <EmptySectionCard
                        key={section}
                        section={section}
                        addExercise={addExercise}
                      />
                    );
                  }

                  return (
                    <div
                      key={section}
                      className="overflow-hidden rounded-[1.5rem] border border-sky-100 bg-sky-50"
                    >
                      <div className="border-b border-sky-100 bg-gradient-to-br from-white via-sky-50 to-blue-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                              Client Section
                            </p>

                            <h3 className="mt-1 text-xl font-black text-slate-900">
                              {section}
                            </h3>

                            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                              {SECTION_DESCRIPTIONS[section]}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => addExercise(section)}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-700"
                          >
                            Add to {section}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 p-4">
                        {sectionExercises.map(({ exercise, originalIndex }) => (
                          <SortableExerciseEditor
                            key={exercise.formId}
                            exercise={exercise}
                            displayIndex={originalIndex + 1}
                            visibleIndex={visibleExercises.findIndex(
                              (item) => item.formId === exercise.formId
                            )}
                            totalVisibleExercises={visibleExercises.length}
                            updateExercise={updateExercise}
                            moveExercise={moveExercise}
                            duplicateExercise={duplicateExercise}
                            removeExercise={removeExercise}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {exercises
                  .filter((exercise) => exercise.shouldDelete)
                  .map((exercise) => (
                    <div
                      key={exercise.formId}
                      className="rounded-2xl border border-red-100 bg-red-50 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-red-700">
                            Marked for deletion
                          </p>
                          <p className="mt-1 text-sm font-semibold text-red-600">
                            {exercise.exerciseName || "Unnamed Exercise"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => restoreExercise(exercise.formId)}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={discardLocalChanges}
            disabled={isSaving}
            className="rounded-2xl border border-red-100 bg-white px-5 py-4 font-black text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Discard Unsaved Edits
          </button>

          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={isSaving}
            className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Preview Client Flow
          </button>

          <button
            type="button"
            onClick={saveWorkoutChanges}
            disabled={isSaving}
            className="rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving Changes..." : "Save Published Changes"}
          </button>
        </div>
      </section>

      {showPreview && (
        <WorkoutPreviewModal
          workoutTitle={workoutTitle}
          weekNumber={String(workout.client_plan_weeks?.week_number || "")}
          clientName={workout.client_plan_weeks?.profiles?.full_name || ""}
          exercises={visibleExercises}
          issues={previewIssues}
          onClose={() => setShowPreview(false)}
        />
      )}
    </main>
  );
}

function EmptySectionCard({
  section,
  addExercise,
}: {
  section: string;
  addExercise: (section: string) => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-sky-200 bg-white/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Empty Section
          </p>

          <h3 className="mt-1 text-lg font-black text-slate-700">{section}</h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {SECTION_DESCRIPTIONS[section]}
          </p>
        </div>

        <button
          type="button"
          onClick={() => addExercise(section)}
          className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50"
        >
          + Add Exercise
        </button>
      </div>
    </div>
  );
}

function SortableExerciseEditor({
  exercise,
  displayIndex,
  visibleIndex,
  totalVisibleExercises,
  updateExercise,
  moveExercise,
  duplicateExercise,
  removeExercise,
}: {
  exercise: ExerciseForm;
  displayIndex: number;
  visibleIndex: number;
  totalVisibleExercises: number;
  updateExercise: (
    formId: string,
    field: keyof ExerciseForm,
    value: string | boolean
  ) => void;
  moveExercise: (formId: string, direction: "up" | "down") => void;
  duplicateExercise: (formId: string) => void;
  removeExercise: (formId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(
    exercise.exerciseName.trim() === ""
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.formId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-[1.35rem] border bg-white transition ${
        isDragging
          ? "z-20 border-blue-200 opacity-80 shadow-xl ring-2 ring-blue-200"
          : "border-sky-100 shadow-sm"
      }`}
    >
      <div className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab rounded-2xl bg-sky-50 px-3 py-2 text-sm font-black text-slate-600 ring-1 ring-sky-100 active:cursor-grabbing"
              aria-label={`Drag Exercise ${displayIndex}`}
            >
              ☰
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">
                Movement {displayIndex}
              </p>

              <h4 className="mt-1 break-words text-lg font-black text-slate-900">
                {exercise.exerciseName.trim() || "New Exercise"}
              </h4>

              <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-500">
                {getExerciseSummary(exercise)}
              </p>

              {exercise.trainerNotes.trim() && !isExpanded && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                  Note: {exercise.trainerNotes}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700"
            >
              {isExpanded ? "Collapse" : "Edit Details"}
            </button>

            <button
              type="button"
              onClick={() => moveExercise(exercise.formId, "up")}
              disabled={visibleIndex === 0}
              className="rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Up
            </button>

            <button
              type="button"
              onClick={() => moveExercise(exercise.formId, "down")}
              disabled={visibleIndex === totalVisibleExercises - 1}
              className="rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Down
            </button>

            <button
              type="button"
              onClick={() => duplicateExercise(exercise.formId)}
              className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100"
            >
              Duplicate
            </button>

            <button
              type="button"
              onClick={() => removeExercise(exercise.formId)}
              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-sky-100 bg-sky-50/60 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Section
              </label>

              <select
                value={exercise.section}
                onChange={(event) =>
                  updateExercise(exercise.formId, "section", event.target.value)
                }
                className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {WORKOUT_SECTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Exercise Name"
              value={exercise.exerciseName}
              onChange={(value) =>
                updateExercise(exercise.formId, "exerciseName", value)
              }
              placeholder="Band Pull Aparts"
            />

            <Input
              label="Sets"
              value={exercise.sets}
              onChange={(value) =>
                updateExercise(exercise.formId, "sets", value)
              }
              placeholder="2"
            />

            <Input
              label="Reps / Time"
              value={exercise.reps}
              onChange={(value) =>
                updateExercise(exercise.formId, "reps", value)
              }
              placeholder="10 reps or 30 sec"
            />

            <Input
              label="Weight"
              value={exercise.weight}
              onChange={(value) =>
                updateExercise(exercise.formId, "weight", value)
              }
              placeholder="None or 45 lbs"
            />

            <Input
              label="Rest"
              value={exercise.rest}
              onChange={(value) =>
                updateExercise(exercise.formId, "rest", value)
              }
              placeholder="30-60 sec"
            />

            <Input
              label="Video Link"
              value={exercise.videoLink}
              onChange={(value) =>
                updateExercise(exercise.formId, "videoLink", value)
              }
              placeholder="https://youtube.com/..."
            />

            <div className="md:col-span-3">
              <label className="mb-2 block text-sm font-black text-slate-700">
                Trainer Notes
              </label>

              <textarea
                value={exercise.trainerNotes}
                onChange={(event) =>
                  updateExercise(
                    exercise.formId,
                    "trainerNotes",
                    event.target.value
                  )
                }
                placeholder="Example: Keep shoulders relaxed, move slowly, stop if pain increases."
                rows={3}
                className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutPreviewModal({
  workoutTitle,
  weekNumber,
  clientName,
  exercises,
  issues,
  onClose,
}: {
  workoutTitle: string;
  weekNumber: string;
  clientName: string;
  exercises: ExerciseForm[];
  issues: {
    missingSets: number;
    missingReps: number;
    missingRest: number;
    missingVideo: number;
    missingNotes: number;
  };
  onClose: () => void;
}) {
  const activeExercises = exercises.filter(
    (exercise) => exercise.exerciseName.trim() !== ""
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-600 px-5 py-6 text-white sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
                Published Workout Preview
              </p>

              <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                {workoutTitle || "Untitled Workout"}
              </h2>

              <p className="mt-2 text-sm font-semibold leading-6 text-blue-50">
                Week {weekNumber || "?"}
                {clientName ? ` • ${clientName}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-black text-white ring-1 ring-white/25 transition hover:bg-white/25"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                Exercises
              </p>
              <p className="mt-1 text-2xl font-black">
                {activeExercises.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                Sections
              </p>
              <p className="mt-1 text-2xl font-black">
                {
                  WORKOUT_SECTIONS.filter((section) =>
                    activeExercises.some(
                      (exercise) => exercise.section === section
                    )
                  ).length
                }
              </p>
            </div>

            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                Mode
              </p>
              <p className="mt-1 text-2xl font-black">Guided</p>
            </div>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5 sm:p-8">
          {(issues.missingSets > 0 ||
            issues.missingReps > 0 ||
            issues.missingRest > 0 ||
            issues.missingVideo > 0 ||
            issues.missingNotes > 0) && (
            <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-700">
                Preview Checklist
              </p>

              <div className="mt-2 grid gap-2 text-sm font-semibold text-amber-700 sm:grid-cols-2">
                {issues.missingSets > 0 && (
                  <p>• {issues.missingSets} missing sets</p>
                )}
                {issues.missingReps > 0 && (
                  <p>• {issues.missingReps} missing reps/time</p>
                )}
                {issues.missingRest > 0 && (
                  <p>• {issues.missingRest} missing rest time</p>
                )}
                {issues.missingVideo > 0 && (
                  <p>• {issues.missingVideo} missing video link</p>
                )}
                {issues.missingNotes > 0 && (
                  <p>• {issues.missingNotes} missing trainer notes</p>
                )}
              </div>
            </div>
          )}

          {activeExercises.length === 0 ? (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
              <h3 className="text-xl font-black text-red-700">
                No exercises to preview
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-red-600">
                Add at least one exercise before saving this workout.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {WORKOUT_SECTIONS.map((section) => {
                const sectionExercises = activeExercises.filter(
                  (exercise) => exercise.section === section
                );

                if (sectionExercises.length === 0) return null;

                return (
                  <div
                    key={section}
                    className="rounded-[1.5rem] border border-sky-100 bg-white p-4"
                  >
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                          Section Intro
                        </p>

                        <h4 className="mt-1 text-xl font-black text-slate-900">
                          {section}
                        </h4>
                      </div>

                      <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-sky-100">
                        {sectionExercises.length} movement
                        {sectionExercises.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {sectionExercises.map((exercise, index) => (
                        <div
                          key={exercise.formId}
                          className="rounded-2xl border border-sky-100 bg-sky-50 p-4"
                        >
                          <div className="flex gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-blue-700 ring-1 ring-sky-100">
                              {index + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="break-words font-black text-slate-900">
                                {exercise.exerciseName}
                              </p>

                              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                                {getExerciseSummary(exercise)}
                              </p>

                              {exercise.trainerNotes && (
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  Trainer note: {exercise.trainerNotes}
                                </p>
                              )}

                              {exercise.videoLink && (
                                <p className="mt-2 text-xs font-black uppercase tracking-wide text-blue-600">
                                  Video attached
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-sky-100 bg-white px-5 py-4 text-sm font-black text-slate-700 transition hover:bg-sky-50"
            >
              Keep Editing
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white transition hover:bg-blue-700"
            >
              Looks Good
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>

      <h2 className="mt-2 break-words text-xl font-black text-slate-900 sm:text-2xl">
        {value}
      </h2>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}