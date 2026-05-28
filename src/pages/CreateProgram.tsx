import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
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

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type ExerciseForm = {
  formId: string;
  section: string;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  videoLink: string;
};

type WorkoutForm = {
  formId: string;
  title: string;
  trainerNotes: string;
  exercises: ExerciseForm[];
};

type ProgramDraftData = {
  workouts: WorkoutForm[];
};

type ProgramDraftRow = {
  id: string;
  trainer_user_id: string;
  target_client_user_id: string;
  week_number: number;
  week_status: string | null;
  draft_data: ProgramDraftData | null;
  updated_at: string;
};

type ExistingExercise = {
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

type ExistingWorkout = {
  id: string;
  title: string;
  trainer_notes?: string | null;
  workout_order: number;
  week_id: string;
  week_number: number;
  source_client_user_id: string;
  source_client_name: string;
  source_client_id: string;
  client_plan_exercises: ExistingExercise[];
};

type PlanWeekWithWorkouts = {
  id: string;
  week_number: number;
  client_user_id: string;
  client_plan_workouts: {
    id: string;
    title: string;
    trainer_notes?: string | null;
    workout_order: number;
    client_plan_exercises: ExistingExercise[];
  }[];
};

type HistoricalExercise = {
  id: string;
  historical_workout_id: string;
  section?: string | null;
  exercise_name?: string | null;
  sets?: string | null;
  reps?: string | null;
  weight?: string | null;
  rest?: string | null;
  notes?: string | null;
  original_line?: string | null;
  exercise_order?: number | null;
  order_index?: number | null;
};

type HistoricalWorkoutTemplate = {
  id: string;
  client_id: string;
  title?: string | null;
  workout_date?: string | null;
  notes?: string | null;
  source?: string | null;
  client_historical_workout_exercises: HistoricalExercise[];
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankExercise(section = "Warm-Up"): ExerciseForm {
  return {
    formId: makeId(),
    section,
    exerciseName: "",
    sets: "",
    reps: "",
    weight: "",
    rest: "",
    videoLink: "",
  };
}

function blankWorkout(): WorkoutForm {
  return {
    formId: makeId(),
    title: "",
    trainerNotes: "",
    exercises: [blankExercise()],
  };
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return "No date";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString();
}

export default function CreateProgram() {
  const saveDraftTimerRef = useRef<number | null>(null);

  const [currentTrainerUserId, setCurrentTrainerUserId] = useState("");
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [copySourceClientId, setCopySourceClientId] = useState("");

  const [weekNumber, setWeekNumber] = useState("1");
  const [weekStatus, setWeekStatus] = useState("unlocked");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [workouts, setWorkouts] = useState<WorkoutForm[]>([blankWorkout()]);

  const [existingWorkouts, setExistingWorkouts] = useState<ExistingWorkout[]>(
    []
  );
  const [selectedWorkoutToCopy, setSelectedWorkoutToCopy] = useState("");
  const [isLoadingExistingWorkouts, setIsLoadingExistingWorkouts] =
    useState(false);

  const [historicalTemplates, setHistoricalTemplates] = useState<
    HistoricalWorkoutTemplate[]
  >([]);
  const [selectedHistoricalClientId, setSelectedHistoricalClientId] =
    useState("all");
  const [selectedHistoricalTemplateId, setSelectedHistoricalTemplateId] =
    useState("");
  const [isLoadingHistoricalTemplates, setIsLoadingHistoricalTemplates] =
    useState(false);

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
    loadTrainerUser();
    loadClients();
    loadHistoricalTemplates();

    return () => {
      if (saveDraftTimerRef.current) {
        window.clearTimeout(saveDraftTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadNextWeekNumber(selectedClientId);
      setCopySourceClientId(selectedClientId);
    } else {
      setWeekNumber("1");
      setCopySourceClientId("");
      setExistingWorkouts([]);
      setSelectedWorkoutToCopy("");
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (copySourceClientId) {
      loadExistingWorkouts(copySourceClientId);
    } else {
      setExistingWorkouts([]);
      setSelectedWorkoutToCopy("");
    }
  }, [copySourceClientId]);

  useEffect(() => {
    if (!currentTrainerUserId || !selectedClientId || !weekNumber) {
      setDraftLoaded(false);
      setDraftSavedAt("");
      return;
    }

    loadProgramDraft();
  }, [currentTrainerUserId, selectedClientId, weekNumber]);

  useEffect(() => {
    if (
      !currentTrainerUserId ||
      !selectedClientId ||
      !weekNumber ||
      !draftLoaded ||
      isSaving ||
      !hasMeaningfulDraftContent()
    ) {
      return;
    }

    if (saveDraftTimerRef.current) {
      window.clearTimeout(saveDraftTimerRef.current);
    }

    saveDraftTimerRef.current = window.setTimeout(() => {
      saveDraftToSupabase();
    }, 800);

    return () => {
      if (saveDraftTimerRef.current) {
        window.clearTimeout(saveDraftTimerRef.current);
      }
    };
  }, [
    currentTrainerUserId,
    selectedClientId,
    weekNumber,
    weekStatus,
    workouts,
    draftLoaded,
    isSaving,
  ]);

  async function loadTrainerUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error(error);
      setStatusMessage("You must be logged in as a trainer to create programs.");
      return;
    }

    setCurrentTrainerUserId(user.id);
  }

  async function loadClients() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, client_id")
      .eq("role", "client")
      .order("full_name", { ascending: true });

    if (error) {
      console.error(error);
      setStatusMessage("Could not load clients: " + error.message);
      return;
    }

    setClients(data || []);
  }

  async function loadHistoricalTemplates() {
    setIsLoadingHistoricalTemplates(true);

    const { data: workoutsData, error: workoutsError } = await supabase
      .from("client_historical_workouts")
      .select("*")
      .order("workout_date", { ascending: false });

    if (workoutsError) {
      console.error(workoutsError);
      setStatusMessage(
        "Could not load historical workout templates: " +
          workoutsError.message
      );
      setHistoricalTemplates([]);
      setIsLoadingHistoricalTemplates(false);
      return;
    }

    const historicalWorkouts = (workoutsData ||
      []) as HistoricalWorkoutTemplate[];

    if (historicalWorkouts.length === 0) {
      setHistoricalTemplates([]);
      setIsLoadingHistoricalTemplates(false);
      return;
    }

    const historicalWorkoutIds = historicalWorkouts.map((workout) => workout.id);

    const { data: exercisesData, error: exercisesError } = await supabase
      .from("client_historical_workout_exercises")
      .select("*")
      .in("historical_workout_id", historicalWorkoutIds);

    if (exercisesError) {
      console.error(exercisesError);
      setStatusMessage(
        "Historical workouts loaded, but exercises could not load: " +
          exercisesError.message
      );

      setHistoricalTemplates(
        historicalWorkouts.map((workout) => ({
          ...workout,
          client_historical_workout_exercises: [],
        }))
      );

      setIsLoadingHistoricalTemplates(false);
      return;
    }

    const exercises = (exercisesData || []) as HistoricalExercise[];

    const templatesWithExercises = historicalWorkouts.map((workout) => ({
      ...workout,
      client_historical_workout_exercises: exercises
        .filter((exercise) => exercise.historical_workout_id === workout.id)
        .sort((a, b) => {
          const aOrder = a.exercise_order ?? a.order_index ?? 0;
          const bOrder = b.exercise_order ?? b.order_index ?? 0;

          return aOrder - bOrder;
        }),
    }));

    setHistoricalTemplates(templatesWithExercises);
    setIsLoadingHistoricalTemplates(false);
  }

  async function loadNextWeekNumber(clientUserId: string) {
    setIsLoadingWeek(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from("client_plan_weeks")
      .select("week_number")
      .eq("client_user_id", clientUserId)
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setStatusMessage("Could not check the target client's latest week.");
      setIsLoadingWeek(false);
      return;
    }

    if (data?.week_number) {
      setWeekNumber(String(data.week_number + 1));
    } else {
      setWeekNumber("1");
    }

    setIsLoadingWeek(false);
  }

  async function loadExistingWorkouts(sourceClientUserId: string) {
    setIsLoadingExistingWorkouts(true);
    setSelectedWorkoutToCopy("");

    const { data, error } = await supabase
      .from("client_plan_weeks")
      .select(
        `
        id,
        week_number,
        client_user_id,
        client_plan_workouts (
          id,
          title,
          trainer_notes,
          workout_order,
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
        )
      `
      )
      .eq("client_user_id", sourceClientUserId)
      .order("week_number", { ascending: false });

    if (error) {
      console.error(error);
      setStatusMessage(
        "Could not load previous workouts to copy: " + error.message
      );
      setExistingWorkouts([]);
      setIsLoadingExistingWorkouts(false);
      return;
    }

    const sourceClient = clients.find(
      (client) => client.id === sourceClientUserId
    );

    const weeks = (data || []) as PlanWeekWithWorkouts[];

    const flattenedWorkouts = weeks.flatMap((week) =>
      (week.client_plan_workouts || []).map((workout) => ({
        ...workout,
        week_id: week.id,
        week_number: week.week_number,
        source_client_user_id: week.client_user_id,
        source_client_name:
          sourceClient?.full_name || sourceClient?.client_id || "Unknown Client",
        source_client_id: sourceClient?.client_id || "Not set",
        client_plan_exercises: [
          ...(workout.client_plan_exercises || []),
        ].sort((a, b) => a.exercise_order - b.exercise_order),
      }))
    );

    const sortedWorkouts = flattenedWorkouts.sort((a, b) => {
      if (a.week_number !== b.week_number) {
        return b.week_number - a.week_number;
      }

      return a.workout_order - b.workout_order;
    });

    setExistingWorkouts(sortedWorkouts);
    setIsLoadingExistingWorkouts(false);
  }

  function getClientName(clientUserId: string) {
    const client = clients.find(
      (currentClient) => currentClient.id === clientUserId
    );

    return client?.full_name || client?.client_id || "Unknown Client";
  }

  function getClientCode(clientUserId: string) {
    const client = clients.find(
      (currentClient) => currentClient.id === clientUserId
    );

    return client?.client_id || "Not set";
  }

  function handleClientChange(value: string) {
    setSelectedClientId(value);
    setDraftLoaded(false);
    setDraftSavedAt("");

    if (!value) {
      setWeekNumber("1");
      setCopySourceClientId("");
      setExistingWorkouts([]);
      setSelectedWorkoutToCopy("");
    }
  }

  function updateWorkoutTitle(workoutIndex: number, value: string) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        return {
          ...workout,
          title: value,
        };
      })
    );
  }

  function updateWorkoutTrainerNotes(workoutIndex: number, value: string) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        return {
          ...workout,
          trainerNotes: value,
        };
      })
    );
  }

  function addWorkout() {
    setWorkouts((currentWorkouts) => [...currentWorkouts, blankWorkout()]);
  }

  function copySelectedWorkout() {
    if (!selectedWorkoutToCopy) {
      setStatusMessage("Choose a workout to copy first.");
      return;
    }

    const workoutToCopy = existingWorkouts.find(
      (workout) => workout.id === selectedWorkoutToCopy
    );

    if (!workoutToCopy) {
      setStatusMessage("Could not find that workout to copy.");
      return;
    }

    copyWorkoutIntoForm(workoutToCopy);
  }

  function copyWorkoutById(workoutId: string) {
    setSelectedWorkoutToCopy(workoutId);

    const workoutToCopy = existingWorkouts.find(
      (workout) => workout.id === workoutId
    );

    if (!workoutToCopy) {
      setStatusMessage("Could not find that workout to copy.");
      return;
    }

    copyWorkoutIntoForm(workoutToCopy);
  }

  function copyWorkoutIntoForm(workoutToCopy: ExistingWorkout) {
    const copiedWorkout: WorkoutForm = {
      formId: makeId(),
      title: `${workoutToCopy.title} Copy`,
      trainerNotes: workoutToCopy.trainer_notes || "",
      exercises:
        workoutToCopy.client_plan_exercises.length > 0
          ? workoutToCopy.client_plan_exercises.map((exercise) => ({
              formId: makeId(),
              section: exercise.section || "Resistance Training",
              exerciseName: exercise.exercise_name || "",
              sets: exercise.sets || "",
              reps: exercise.reps || "",
              weight: exercise.weight || "",
              rest: exercise.rest || "",
              videoLink: exercise.video_link || "",
            }))
          : [blankExercise()],
    };

    addCopiedWorkoutToForm(copiedWorkout);

    setStatusMessage(
      `"${workoutToCopy.title}" from ${workoutToCopy.source_client_name} copied into the form. You can now edit it before saving to the target client.`
    );
  }

  function copySelectedHistoricalTemplate() {
    if (!selectedHistoricalTemplateId) {
      setStatusMessage("Choose a past workout template first.");
      return;
    }

    const template = historicalTemplates.find(
      (workout) => workout.id === selectedHistoricalTemplateId
    );

    if (!template) {
      setStatusMessage("Could not find that past workout template.");
      return;
    }

    copyHistoricalTemplateIntoForm(template);
  }

  function copyHistoricalTemplateById(templateId: string) {
    setSelectedHistoricalTemplateId(templateId);

    const template = historicalTemplates.find(
      (workout) => workout.id === templateId
    );

    if (!template) {
      setStatusMessage("Could not find that past workout template.");
      return;
    }

    copyHistoricalTemplateIntoForm(template);
  }

  function copyHistoricalTemplateIntoForm(template: HistoricalWorkoutTemplate) {
    const sortedExercises = [
      ...(template.client_historical_workout_exercises || []),
    ].sort((a, b) => {
      const aOrder = a.exercise_order ?? a.order_index ?? 0;
      const bOrder = b.exercise_order ?? b.order_index ?? 0;

      return aOrder - bOrder;
    });

    const copiedWorkout: WorkoutForm = {
      formId: makeId(),
      title: template.title
        ? `${template.title} Template`
        : "Past Workout Template",
      trainerNotes: template.notes || "",
      exercises:
        sortedExercises.length > 0
          ? sortedExercises.map((exercise) => {
              const section = exercise.section?.trim() || "Resistance Training";
              const exerciseName = exercise.exercise_name?.trim();
              const fallbackLine = exercise.original_line?.trim();

              return {
                formId: makeId(),
                section,
                exerciseName:
                  exerciseName ||
                  fallbackLine ||
                  (section ? `${section} Exercise` : "Imported Exercise"),
                sets: exercise.sets || "",
                reps: exercise.reps || "",
                weight: exercise.weight || "",
                rest: exercise.rest || "",
                videoLink: "",
              };
            })
          : [blankExercise()],
    };

    addCopiedWorkoutToForm(copiedWorkout);

    setStatusMessage(
      `"${template.title || "Past workout"}" from ${getClientName(
        template.client_id
      )} copied as a template. You can edit it before saving to the target client.`
    );
  }

  function addCopiedWorkoutToForm(copiedWorkout: WorkoutForm) {
    setWorkouts((currentWorkouts) => {
      const hasOnlyBlankWorkout =
        currentWorkouts.length === 1 &&
        currentWorkouts[0].title.trim() === "" &&
        currentWorkouts[0].trainerNotes.trim() === "" &&
        currentWorkouts[0].exercises.length === 1 &&
        currentWorkouts[0].exercises[0].exerciseName.trim() === "";

      if (hasOnlyBlankWorkout) {
        return [copiedWorkout];
      }

      return [...currentWorkouts, copiedWorkout];
    });
  }

  function duplicateWorkoutInForm(workoutIndex: number) {
    const workoutToDuplicate = workouts[workoutIndex];

    if (!workoutToDuplicate) return;

  const copiedWorkout: WorkoutForm = {
    formId: makeId(),
    title: workoutToDuplicate.title
      ? `${workoutToDuplicate.title} Copy`
      : `Workout ${workoutIndex + 1} Copy`,
    trainerNotes: workoutToDuplicate.trainerNotes || "",
    exercises: workoutToDuplicate.exercises.map((exercise) => ({
      ...exercise,
      formId: makeId(),
    })),
  };

    setWorkouts((currentWorkouts) => [
      ...currentWorkouts.slice(0, workoutIndex + 1),
      copiedWorkout,
      ...currentWorkouts.slice(workoutIndex + 1),
    ]);

    setStatusMessage("Workout duplicated in the form.");
  }

  function removeWorkout(workoutIndex: number) {
    if (workouts.length === 1) {
      setStatusMessage("You need at least one workout in the week.");
      return;
    }

    setWorkouts((currentWorkouts) =>
      currentWorkouts.filter((_, index) => index !== workoutIndex)
    );
  }

  function updateExercise(
    workoutIndex: number,
    exerciseIndex: number,
    field: keyof ExerciseForm,
    value: string
  ) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, currentWorkoutIndex) => {
        if (currentWorkoutIndex !== workoutIndex) return workout;

        return {
          ...workout,
          exercises: workout.exercises.map((exercise, currentExerciseIndex) => {
            if (currentExerciseIndex !== exerciseIndex) return exercise;

            return {
              ...exercise,
              [field]: value,
            };
          }),
        };
      })
    );
  }

  function addExercise(workoutIndex: number, section = "Resistance Training") {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        return {
          ...workout,
          exercises: [...workout.exercises, blankExercise(section)],
        };
      })
    );
  }

  function moveExercise(
    workoutIndex: number,
    exerciseIndex: number,
    direction: "up" | "down"
  ) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, currentWorkoutIndex) => {
        if (currentWorkoutIndex !== workoutIndex) return workout;

        const targetIndex =
          direction === "up" ? exerciseIndex - 1 : exerciseIndex + 1;

        if (targetIndex < 0 || targetIndex >= workout.exercises.length) {
          return workout;
        }

        return {
          ...workout,
          exercises: arrayMove(workout.exercises, exerciseIndex, targetIndex),
        };
      })
    );
  }

  function handleExerciseDragEnd(workoutIndex: number, event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, currentWorkoutIndex) => {
        if (currentWorkoutIndex !== workoutIndex) return workout;

        const oldIndex = workout.exercises.findIndex(
          (exercise) => exercise.formId === active.id
        );

        const newIndex = workout.exercises.findIndex(
          (exercise) => exercise.formId === over.id
        );

        if (oldIndex === -1 || newIndex === -1) return workout;

        return {
          ...workout,
          exercises: arrayMove(workout.exercises, oldIndex, newIndex),
        };
      })
    );
  }

  function removeExercise(workoutIndex: number, exerciseIndex: number) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        if (workout.exercises.length === 1) {
          setStatusMessage("Each workout needs at least one exercise.");
          return workout;
        }

        return {
          ...workout,
          exercises: workout.exercises.filter(
            (_, currentExerciseIndex) => currentExerciseIndex !== exerciseIndex
          ),
        };
      })
    );
  }

  function hasMeaningfulDraftContent() {
    if (!selectedClientId || !weekNumber) return false;

    return workouts.some((workout) => {
      const hasWorkoutText =
        workout.title.trim() !== "" || workout.trainerNotes.trim() !== "";

      const hasExerciseText = workout.exercises.some(
        (exercise) =>
          exercise.exerciseName.trim() !== "" ||
          exercise.sets.trim() !== "" ||
          exercise.reps.trim() !== "" ||
          exercise.weight.trim() !== "" ||
          exercise.rest.trim() !== "" ||
          exercise.videoLink.trim() !== ""
      );

      return hasWorkoutText || hasExerciseText;
    });
  }

  async function loadProgramDraft() {
    if (!currentTrainerUserId || !selectedClientId || !weekNumber) return;

    setDraftLoaded(false);

    const targetWeekNumber = Number(weekNumber);

    if (!targetWeekNumber || targetWeekNumber < 1) {
      setDraftLoaded(true);
      return;
    }

    const { data, error } = await supabase
      .from("trainer_program_drafts")
      .select(
        "id, trainer_user_id, target_client_user_id, week_number, week_status, draft_data, updated_at"
      )
      .eq("trainer_user_id", currentTrainerUserId)
      .eq("target_client_user_id", selectedClientId)
      .eq("week_number", targetWeekNumber)
      .maybeSingle();

    if (error) {
      console.error(error);
      setStatusMessage("Could not load saved program draft: " + error.message);
      setDraftLoaded(true);
      return;
    }

    if (data) {
      const draft = data as ProgramDraftRow;
      const draftWorkouts = draft.draft_data?.workouts || [];

      if (draft.week_status) {
        setWeekStatus(draft.week_status);
      }

      if (draftWorkouts.length > 0) {
        setWorkouts(
          draftWorkouts.map((workout) => ({
            formId: workout.formId || makeId(),
            title: workout.title || "",
            trainerNotes: workout.trainerNotes || "",
            exercises:
              workout.exercises && workout.exercises.length > 0
                ? workout.exercises.map((exercise) => ({
                    formId: exercise.formId || makeId(),
                    section: exercise.section || "Resistance Training",
                    exerciseName: exercise.exerciseName || "",
                    sets: exercise.sets || "",
                    reps: exercise.reps || "",
                    weight: exercise.weight || "",
                    rest: exercise.rest || "",
                    videoLink: exercise.videoLink || "",
                  }))
                : [blankExercise()],
          }))
        );
      }

      setDraftSavedAt(draft.updated_at || "");
      setStatusMessage("Saved draft restored. You can continue editing.");
    } else {
      setDraftSavedAt("");
    }

    setDraftLoaded(true);
  }

  async function saveDraftToSupabase() {
    if (!currentTrainerUserId || !selectedClientId || !weekNumber) return;

    const targetWeekNumber = Number(weekNumber);

    if (!targetWeekNumber || targetWeekNumber < 1) return;

    setIsSavingDraft(true);

    const now = new Date().toISOString();

    const draftPayload = {
      trainer_user_id: currentTrainerUserId,
      target_client_user_id: selectedClientId,
      week_number: targetWeekNumber,
      week_status: weekStatus,
      draft_data: {
        workouts,
      },
      updated_at: now,
    };

    const { data: existingDraft, error: findError } = await supabase
      .from("trainer_program_drafts")
      .select("id")
      .eq("trainer_user_id", currentTrainerUserId)
      .eq("target_client_user_id", selectedClientId)
      .eq("week_number", targetWeekNumber)
      .maybeSingle();

    if (findError) {
      console.error(findError);
      setStatusMessage("Program draft could not auto-save: " + findError.message);
      setIsSavingDraft(false);
      return;
    }

    if (existingDraft) {
      const { error: updateError } = await supabase
        .from("trainer_program_drafts")
        .update({
          week_status: draftPayload.week_status,
          draft_data: draftPayload.draft_data,
          updated_at: draftPayload.updated_at,
        })
        .eq("id", existingDraft.id);

      if (updateError) {
        console.error(updateError);
        setStatusMessage(
          "Program draft could not auto-save: " + updateError.message
        );
        setIsSavingDraft(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("trainer_program_drafts")
        .insert(draftPayload);

      if (insertError) {
        console.error(insertError);
        setStatusMessage(
          "Program draft could not auto-save: " + insertError.message
        );
        setIsSavingDraft(false);
        return;
      }
    }

    setDraftSavedAt(now);
    setIsSavingDraft(false);
  }

  async function clearProgramDraft(weekToClear = weekNumber) {
    if (!currentTrainerUserId || !selectedClientId || !weekToClear) return;

    const targetWeekNumber = Number(weekToClear);

    if (!targetWeekNumber || targetWeekNumber < 1) return;

    await supabase
      .from("trainer_program_drafts")
      .delete()
      .eq("trainer_user_id", currentTrainerUserId)
      .eq("target_client_user_id", selectedClientId)
      .eq("week_number", targetWeekNumber);

    setDraftSavedAt("");
  }

  async function resetProgramDraft() {
    const confirmed = window.confirm(
      "This will clear the saved draft for this client and week. Are you sure?"
    );

    if (!confirmed) return;

    await clearProgramDraft();

    setWorkouts([blankWorkout()]);
    setWeekStatus("unlocked");
    setStatusMessage("Saved draft cleared for this client/week.");
  }

  async function saveProgram(event: FormEvent) {
    event.preventDefault();

    if (!selectedClientId) {
      setStatusMessage("Please select a target client.");
      return;
    }

    if (!weekNumber || Number(weekNumber) < 1) {
      setStatusMessage("Week number is required and must be at least 1.");
      return;
    }

    const validWorkouts = workouts
      .map((workout) => ({
        ...workout,
        title: workout.title.trim(),
        trainerNotes: workout.trainerNotes.trim(),
        exercises: workout.exercises
          .map((exercise) => ({
            ...exercise,
            section: exercise.section.trim() || "Resistance Training",
            exerciseName: exercise.exerciseName.trim(),
            sets: exercise.sets.trim(),
            reps: exercise.reps.trim(),
            weight: exercise.weight.trim(),
            rest: exercise.rest.trim(),
            videoLink: exercise.videoLink.trim(),
          }))
          .filter((exercise) => exercise.exerciseName !== ""),
      }))
      .filter((workout) => workout.title !== "" && workout.exercises.length > 0);

    if (validWorkouts.length === 0) {
      setStatusMessage(
        "Add at least one workout title with at least one exercise."
      );
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving program week...");

    const targetWeekNumber = Number(weekNumber);

    const { data: existingWeek, error: existingWeekError } = await supabase
      .from("client_plan_weeks")
      .select("id")
      .eq("client_user_id", selectedClientId)
      .eq("week_number", targetWeekNumber)
      .maybeSingle();

    if (existingWeekError) {
      console.error(existingWeekError);
      setStatusMessage("Could not check for existing week.");
      setIsSaving(false);
      return;
    }

    let weekId = existingWeek?.id || "";
    let addingToExistingWeek = false;

    if (existingWeek) {
      weekId = existingWeek.id;
      addingToExistingWeek = true;
      setStatusMessage(
        `Week ${targetWeekNumber} already exists. Adding the workout(s) to that week...`
      );
    } else {
      const { data: weekData, error: weekError } = await supabase
        .from("client_plan_weeks")
        .insert({
          client_user_id: selectedClientId,
          week_number: targetWeekNumber,
          status: weekStatus,
        })
        .select("id")
        .single();

      if (weekError || !weekData) {
        console.error(weekError);
        setStatusMessage(weekError?.message || "Could not create week.");
        setIsSaving(false);
        return;
      }

      weekId = weekData.id;
    }

    const { data: currentWorkoutsForWeek, error: currentWorkoutsError } =
      await supabase
        .from("client_plan_workouts")
        .select("workout_order")
        .eq("week_id", weekId)
        .order("workout_order", { ascending: false });

    if (currentWorkoutsError) {
      console.error(currentWorkoutsError);
      setStatusMessage("Could not check current workout order.");
      setIsSaving(false);
      return;
    }

    const currentHighestWorkoutOrder =
      currentWorkoutsForWeek && currentWorkoutsForWeek.length > 0
        ? currentWorkoutsForWeek[0].workout_order || 0
        : 0;

    for (
      let workoutIndex = 0;
      workoutIndex < validWorkouts.length;
      workoutIndex++
    ) {
      const workout = validWorkouts[workoutIndex];

      const { data: workoutData, error: workoutError } = await supabase
        .from("client_plan_workouts")
        .insert({
          week_id: weekId,
          title: workout.title,
          trainer_notes: workout.trainerNotes,
          workout_order: currentHighestWorkoutOrder + workoutIndex + 1,
        })
        .select()
        .single();

      if (workoutError || !workoutData) {
        console.error(workoutError);
        setStatusMessage(
          workoutError?.message ||
            `Could not create workout ${workoutIndex + 1}.`
        );
        setIsSaving(false);
        return;
      }

      const exerciseRows = workout.exercises.map((exercise, exerciseIndex) => ({
        workout_id: workoutData.id,
        section: exercise.section,
        exercise_name: exercise.exerciseName,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        rest: exercise.rest,
        video_link: exercise.videoLink,
        exercise_order: exerciseIndex + 1,
      }));

      const { error: exerciseError } = await supabase
        .from("client_plan_exercises")
        .insert(exerciseRows);

      if (exerciseError) {
        console.error(exerciseError);
        setStatusMessage(
          `Workout "${workout.title}" was created, but exercises failed: ` +
            exerciseError.message
        );
        setIsSaving(false);
        return;
      }
    }

    await clearProgramDraft(String(targetWeekNumber));

    setStatusMessage(
      addingToExistingWeek
        ? `Added ${validWorkouts.length} workout${
            validWorkouts.length === 1 ? "" : "s"
          } to Week ${targetWeekNumber}.`
        : `Week ${targetWeekNumber} saved successfully.`
    );

    setWeekNumber(String(targetWeekNumber + 1));
    setWeekStatus("unlocked");
    setWorkouts([blankWorkout()]);
    setIsSaving(false);

    if (copySourceClientId) {
      await loadExistingWorkouts(copySourceClientId);
    }

    await loadHistoricalTemplates();
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const copySourceClient = clients.find(
    (client) => client.id === copySourceClientId
  );

  const filteredHistoricalTemplates = historicalTemplates.filter((template) =>
    selectedHistoricalClientId === "all"
      ? true
      : template.client_id === selectedHistoricalClientId
  );

  const historicalClientsWithTemplates = clients.filter((client) =>
    historicalTemplates.some((template) => template.client_id === client.id)
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Program Builder
                </p>

                <h1 className="mt-3 break-words text-3xl font-bold md:text-4xl">
                  Create Client Program
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Build a section-based workout using your NASM flow: warm-up,
                  activation, SAQ, resistance training, and cool-down.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {selectedClientId && (
                  <Link
                    to={`/clients/${selectedClientId}`}
                    className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:py-2"
                  >
                    View Target Client
                  </Link>
                )}

                <Link
                  to="/trainer"
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-4 md:p-8">
            <SummaryCard title="Step 1" value="Choose Target" />
            <SummaryCard title="Step 2" value="Copy or Template" />
            <SummaryCard title="Step 3" value="Build by Section" />
            <SummaryCard title="Step 4" value="Autosave + Save" />
          </div>
        </div>

        <form
          onSubmit={saveProgram}
          className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Target Client
              </label>

              <select
                value={selectedClientId}
                onChange={(event) => handleClientChange(event.target.value)}
                className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select target client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} — {client.client_id}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label={isLoadingWeek ? "Week Number Loading..." : "Week Number"}
              value={weekNumber}
              onChange={setWeekNumber}
              placeholder="1"
              type="number"
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Week Status
              </label>

              <select
                value={weekStatus}
                onChange={(event) => setWeekStatus(event.target.value)}
                className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="unlocked">Unlocked</option>
                <option value="locked">Locked</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {selectedClient && (
            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <p className="text-sm font-medium text-slate-500">
                Target Client
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                This workout/week will be saved to {selectedClient.full_name} —{" "}
                {selectedClient.client_id}. If Week {weekNumber} already exists,
                the workout will be added into that week.
              </p>
            </div>
          )}

          {selectedClientId && (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-emerald-700">
                    Draft Autosave
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {isSavingDraft
                      ? "Saving program draft..."
                      : draftSavedAt
                      ? `Draft saved at ${new Date(draftSavedAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}.`
                      : "Start typing and this program draft will save automatically."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetProgramDraft}
                  disabled={isSaving || isSavingDraft}
                  className="rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear Draft
                </button>
              </div>
            </div>
          )}

          {selectedClientId && (
            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Copy Existing Assigned Workout
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Choose any client as the source, copy one of their assigned
                    workouts, then edit it before saving it to the target client.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!copySourceClientId) {
                      setStatusMessage("Choose a copy source client first.");
                      return;
                    }

                    loadExistingWorkouts(copySourceClientId);
                  }}
                  className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:py-2"
                >
                  Refresh Source Workouts
                </button>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Copy From Client
                </label>

                <select
                  value={copySourceClientId}
                  onChange={(event) => setCopySourceClientId(event.target.value)}
                  className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select source client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name} — {client.client_id}
                    </option>
                  ))}
                </select>

                {copySourceClient && (
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    Source: {copySourceClient.full_name} —{" "}
                    {copySourceClient.client_id}
                  </p>
                )}
              </div>

              {isLoadingExistingWorkouts ? (
                <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-600">
                  Loading source workouts...
                </p>
              ) : !copySourceClientId ? (
                <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-600">
                  Choose a source client to see workouts you can copy.
                </p>
              ) : existingWorkouts.length === 0 ? (
                <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-600">
                  No previous assigned workouts found for this source client
                  yet.
                </p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Select Workout to Copy
                      </label>

                      <select
                        value={selectedWorkoutToCopy}
                        onChange={(event) =>
                          setSelectedWorkoutToCopy(event.target.value)
                        }
                        className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Choose source workout</option>
                        {existingWorkouts.map((workout) => (
                          <option key={workout.id} value={workout.id}>
                            {workout.source_client_name} — Week{" "}
                            {workout.week_number} — {workout.title} (
                            {workout.client_plan_exercises.length} exercises)
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={copySelectedWorkout}
                      className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Copy Into Form
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {existingWorkouts.slice(0, 6).map((workout) => (
                      <button
                        key={workout.id}
                        type="button"
                        onClick={() => copyWorkoutById(workout.id)}
                        className="rounded-2xl border border-blue-100 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                          {workout.source_client_name} • Week{" "}
                          {workout.week_number}
                        </p>

                        <h3 className="mt-1 font-bold text-slate-900">
                          {workout.title}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {workout.client_plan_exercises.length} exercise
                          {workout.client_plan_exercises.length === 1
                            ? ""
                            : "s"}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {selectedClientId && (
            <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Use Imported Past Workout as Template
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Copy an imported historical workout into this program. This
                    keeps the warm-up, activation, SAQ, resistance, and cool-down
                    sections when available.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadHistoricalTemplates}
                  className="rounded-xl border border-amber-100 bg-white px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 sm:py-2"
                >
                  Refresh Templates
                </button>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Filter Templates by Client
                  </label>

                  <select
                    value={selectedHistoricalClientId}
                    onChange={(event) => {
                      setSelectedHistoricalClientId(event.target.value);
                      setSelectedHistoricalTemplateId("");
                    }}
                    className="w-full rounded-xl border border-amber-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="all">All clients</option>
                    {historicalClientsWithTemplates.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.full_name} — {client.client_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Select Past Workout Template
                  </label>

                  <select
                    value={selectedHistoricalTemplateId}
                    onChange={(event) =>
                      setSelectedHistoricalTemplateId(event.target.value)
                    }
                    className="w-full rounded-xl border border-amber-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">Choose template</option>
                    {filteredHistoricalTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {getClientName(template.client_id)} —{" "}
                        {formatDate(template.workout_date)} —{" "}
                        {template.title || "Untitled Past Workout"} (
                        {
                          template.client_historical_workout_exercises.length
                        }{" "}
                        exercises)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoadingHistoricalTemplates ? (
                <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-600">
                  Loading imported past workout templates...
                </p>
              ) : historicalTemplates.length === 0 ? (
                <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-600">
                  No imported historical workouts found yet. Import past notes
                  first, then they will appear here as templates.
                </p>
              ) : filteredHistoricalTemplates.length === 0 ? (
                <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-600">
                  No templates found for this client.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={copySelectedHistoricalTemplate}
                    className="mb-4 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    Copy Selected Template Into Form
                  </button>

                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredHistoricalTemplates.slice(0, 8).map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => copyHistoricalTemplateById(template.id)}
                        className="rounded-2xl border border-amber-100 bg-white p-4 text-left transition hover:border-amber-200 hover:bg-amber-50"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                          {getClientName(template.client_id)} •{" "}
                          {formatDate(template.workout_date)}
                        </p>

                        <h3 className="mt-1 font-bold text-slate-900">
                          {template.title || "Untitled Past Workout"}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          ID: {getClientCode(template.client_id)}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            template.client_historical_workout_exercises.length
                          }{" "}
                          exercise
                          {template.client_historical_workout_exercises
                            .length === 1
                            ? ""
                            : "s"}
                        </p>

                        <div className="mt-3 space-y-1">
                          {template.client_historical_workout_exercises
                            .slice(0, 3)
                            .map((exercise) => (
                              <p
                                key={exercise.id}
                                className="line-clamp-1 text-xs text-slate-500"
                              >
                                {exercise.section
                                  ? `${exercise.section}: `
                                  : ""}
                                {exercise.exercise_name ||
                                  exercise.original_line ||
                                  "Imported exercise"}
                              </p>
                            ))}

                          {template.client_historical_workout_exercises.length >
                            3 && (
                            <p className="text-xs font-semibold text-amber-600">
                              +
                              {template.client_historical_workout_exercises
                                .length - 3}{" "}
                              more
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-8">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Workouts / Sessions
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Build each workout by section. Add warm-up, activation, SAQ,
                  resistance training, and cool-down exercises.
                </p>
              </div>

              <button
                type="button"
                onClick={addWorkout}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2"
              >
                Add Workout
              </button>
            </div>

            <div className="space-y-6">
              {workouts.map((workout, workoutIndex) => (
                <div
                  key={workout.formId}
                  className="rounded-3xl border border-sky-100 bg-sky-50 p-4 sm:p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      Workout {workoutIndex + 1}
                    </h3>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => duplicateWorkoutInForm(workoutIndex)}
                        className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50"
                      >
                        Duplicate
                      </button>

                      <button
                        type="button"
                        onClick={() => removeWorkout(workoutIndex)}
                        className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
                      >
                        Remove Workout
                      </button>
                    </div>
                  </div>

                  <Input
                    label="Workout Title"
                    value={workout.title}
                    onChange={(value) => updateWorkoutTitle(workoutIndex, value)}
                    placeholder="Day 1 Stabilization Endurance"
                  />

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Trainer Notes
                    </label>

                    <textarea
                      value={workout.trainerNotes}
                      onChange={(event) =>
                        updateWorkoutTrainerNotes(workoutIndex, event.target.value)
                      }
                      placeholder="Example: Focus on controlled tempo, neutral spine, breathing, and pain-free range of motion."
                      rows={3}
                      className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">Exercises</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Use the section buttons to build the workout in your
                          coaching flow.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {WORKOUT_SECTIONS.map((section) => (
                          <button
                            key={section}
                            type="button"
                            onClick={() => addExercise(workoutIndex, section)}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50"
                          >
                            + {section}
                          </button>
                        ))}
                      </div>
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) =>
                        handleExerciseDragEnd(workoutIndex, event)
                      }
                    >
                      <SortableContext
                        items={workout.exercises.map(
                          (exercise) => exercise.formId
                        )}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-6">
                          {WORKOUT_SECTIONS.map((section) => {
                            const sectionExercises = workout.exercises
                              .map((exercise, originalIndex) => ({
                                exercise,
                                originalIndex,
                              }))
                              .filter(
                                (item) => item.exercise.section === section
                              );

                            if (sectionExercises.length === 0) return null;

                            return (
                              <div
                                key={section}
                                className="rounded-3xl border border-sky-100 bg-white/70 p-4"
                              >
                                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <h5 className="text-base font-bold text-slate-900">
                                      {section}
                                    </h5>

                                    <p className="text-xs font-medium text-slate-500">
                                      {sectionExercises.length} exercise
                                      {sectionExercises.length === 1
                                        ? ""
                                        : "s"}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      addExercise(workoutIndex, section)
                                    }
                                    className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50"
                                  >
                                    Add to {section}
                                  </button>
                                </div>

                                <div className="space-y-4">
                                  {sectionExercises.map(
                                    ({ exercise, originalIndex }) => (
                                      <SortableExerciseCard
                                        key={exercise.formId}
                                        exercise={exercise}
                                        exerciseIndex={originalIndex}
                                        displayIndex={originalIndex + 1}
                                        workoutIndex={workoutIndex}
                                        totalExercises={
                                          workout.exercises.length
                                        }
                                        updateExercise={updateExercise}
                                        moveExercise={moveExercise}
                                        removeExercise={removeExercise}
                                      />
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {statusMessage && (
            <p className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium leading-6 text-slate-700">
              {statusMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving Program..." : "Save Program Week / Add to Week"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SortableExerciseCard({
  exercise,
  exerciseIndex,
  displayIndex,
  workoutIndex,
  totalExercises,
  updateExercise,
  moveExercise,
  removeExercise,
}: {
  exercise: ExerciseForm;
  exerciseIndex: number;
  displayIndex: number;
  workoutIndex: number;
  totalExercises: number;
  updateExercise: (
    workoutIndex: number,
    exerciseIndex: number,
    field: keyof ExerciseForm,
    value: string
  ) => void;
  moveExercise: (
    workoutIndex: number,
    exerciseIndex: number,
    direction: "up" | "down"
  ) => void;
  removeExercise: (workoutIndex: number, exerciseIndex: number) => void;
}) {
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
      className={`rounded-2xl border border-sky-100 bg-white p-4 transition ${
        isDragging ? "z-20 opacity-80 shadow-xl ring-2 ring-blue-200" : ""
      }`}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-sky-100 active:cursor-grabbing"
            aria-label={`Drag Exercise ${displayIndex}`}
          >
            ☰ Drag
          </button>

          <h5 className="font-semibold text-slate-900">
            Exercise {displayIndex}
          </h5>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => moveExercise(workoutIndex, exerciseIndex, "up")}
            disabled={exerciseIndex === 0}
            className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Move Up
          </button>

          <button
            type="button"
            onClick={() => moveExercise(workoutIndex, exerciseIndex, "down")}
            disabled={exerciseIndex === totalExercises - 1}
            className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Move Down
          </button>

          <button
            type="button"
            onClick={() => removeExercise(workoutIndex, exerciseIndex)}
            className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Section
          </label>

          <select
            value={exercise.section}
            onChange={(event) =>
              updateExercise(
                workoutIndex,
                exerciseIndex,
                "section",
                event.target.value
              )
            }
            className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
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
            updateExercise(workoutIndex, exerciseIndex, "exerciseName", value)
          }
          placeholder="Band Pull Aparts"
        />

        <Input
          label="Sets"
          value={exercise.sets}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "sets", value)
          }
          placeholder="2"
        />

        <Input
          label="Reps / Time"
          value={exercise.reps}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "reps", value)
          }
          placeholder="10 reps or 30 sec"
        />

        <Input
          label="Weight"
          value={exercise.weight}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "weight", value)
          }
          placeholder="None or 45 lbs"
        />

        <Input
          label="Rest"
          value={exercise.rest}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "rest", value)
          }
          placeholder="30-60 sec"
        />

        <Input
          label="Video Link"
          value={exercise.videoLink}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "videoLink", value)
          }
          placeholder="https://youtube.com/..."
        />
      </div>
    </div>
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
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}