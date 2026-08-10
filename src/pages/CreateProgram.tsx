import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type TrainingPlan = {
  id: string;
  client_user_id: string;
  name: string;
  plan_type: "fixed" | "ongoing";
  planned_weeks: number | null;
  status: "draft" | "active" | "completed" | "archived";
  start_date: string | null;
  created_at: string;
};

type ExerciseLibraryItem = {
  id: string;
  exercise_name: string;
  default_section: string | null;
  movement_pattern: string | null;
  default_sets: string | null;
  default_reps: string | null;
  default_weight: string | null;
  default_rest: string | null;
  video_link: string | null;
  trainer_notes: string | null;
  tags: string[] | null;
};

type ExerciseType = "reps" | "timed";

type ExerciseForm = {
  formId: string;
  section: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  videoLink: string;
  trainerNotes: string;
};

type WorkoutForm = {
  formId: string;
  title: string;
  exercises: ExerciseForm[];
};

type ProgramDraftData = {
  workouts: WorkoutForm[];
};

type ProgramDraftRow = {
  id: string;
  trainer_user_id: string;
  target_client_user_id: string;
  plan_id: string | null;
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
  trainer_notes?: string | null;
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

type CompletedWorkoutSubmission = {
  id: string;
  workout_title: string | null;
  submitted_at: string;
};

type CompletedWorkoutExercise = {
  id: string;
  submission_id: string;
  exercise_name: string | null;
  planned_sets: string | null;
  planned_reps: string | null;
  planned_weight: string | null;
  planned_rest: string | null;
  completed: boolean | null;
  difficulty: string | null;
  notes: string | null;
};

type ExerciseHistoryItem = {
  exerciseName: string;
  workoutTitle: string;
  completedAt: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  difficulty: string;
  notes: string;
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
    exerciseType: "reps",
    sets: "",
    reps: "",
    weight: "",
    rest: "",
    videoLink: "",
    trainerNotes: "",
  };
}

function blankWorkout(): WorkoutForm {
  return {
    formId: makeId(),
    title: "",
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

function inferExerciseType(repsValue?: string | null): ExerciseType {
  const value = (repsValue || "").toLowerCase();

  if (
    value.includes("sec") ||
    value.includes("second") ||
    value.includes("min") ||
    value.includes("minute")
  ) {
    return "timed";
  }

  return "reps";
}

function normalizeExerciseName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length > 3 && word.endsWith("s")) {
        return word.slice(0, -1);
      }

      return word;
    })
    .join(" ");
}

function getWorkoutExerciseCount(workout: WorkoutForm) {
  return workout.exercises.filter(
    (exercise) => exercise.exerciseName.trim() !== ""
  ).length;
}

function getWorkoutSectionCount(workout: WorkoutForm) {
  return WORKOUT_SECTIONS.filter((section) =>
    workout.exercises.some(
      (exercise) =>
        exercise.section === section && exercise.exerciseName.trim() !== ""
    )
  ).length;
}

function getExerciseSummary(exercise: ExerciseForm) {
  const parts = [
    exercise.sets ? `${exercise.sets} set${exercise.sets.trim() === "1" ? "" : "s"}` : "",
    exercise.reps ? exercise.reps : "",
    exercise.weight ? exercise.weight : "",
    exercise.rest ? `${exercise.rest} rest` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" • ") : "No sets/reps/rest added";
}

function getWorkoutPreviewIssues(workout: WorkoutForm) {
  const exercises = workout.exercises.filter(
    (exercise) => exercise.exerciseName.trim() !== ""
  );

  return {
    missingRest: exercises.filter((exercise) => exercise.rest.trim() === "")
      .length,
    missingVideo: exercises.filter(
      (exercise) => exercise.videoLink.trim() === ""
    ).length,
    missingNotes: exercises.filter(
      (exercise) => exercise.trainerNotes.trim() === ""
    ).length,
    missingSets: exercises.filter((exercise) => exercise.sets.trim() === "")
      .length,
    missingReps: exercises.filter((exercise) => exercise.reps.trim() === "")
      .length,
  };
}

const SMART_IMPORT_SECTION_MATCHES: { label: string; section: string }[] = [
  { label: "warm-up", section: "Warm-Up" },
  { label: "warm up", section: "Warm-Up" },
  { label: "warmup", section: "Warm-Up" },
  { label: "activation", section: "Activation / Core / Balance" },
  { label: "core", section: "Activation / Core / Balance" },
  { label: "balance", section: "Activation / Core / Balance" },
  { label: "saq", section: "SAQ / Skill Development" },
  { label: "skill development", section: "SAQ / Skill Development" },
  { label: "resistance training", section: "Resistance Training" },
  { label: "resistance", section: "Resistance Training" },
  { label: "cool-down", section: "Cool-Down" },
  { label: "cool down", section: "Cool-Down" },
  { label: "cooldown", section: "Cool-Down" },
];

function getSmartImportSection(line: string) {
  const normalized = normalizeExerciseName(line);

  const directMatch = SMART_IMPORT_SECTION_MATCHES.find(
    (item) => normalized === normalizeExerciseName(item.label)
  );

  if (directMatch) return directMatch.section;

  const containsMatch = SMART_IMPORT_SECTION_MATCHES.find((item) =>
    normalized.includes(normalizeExerciseName(item.label))
  );

  return containsMatch?.section || "";
}

function isSmartImportHeaderLine(line: string) {
  const normalized = normalizeExerciseName(line);

  if (!normalized) return true;

  const skipWords = [
    "exercise set range tempo weight rest note",
    "exercise sets week",
    "progressive overload",
    "6 week",
    "phase",
    "client name",
    "resttttt",
  ];

  return skipWords.some((word) => normalized.includes(normalizeExerciseName(word)));
}

function splitSmartImportRow(line: string) {
  return line
    .split(/\t| {2,}/g)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function parseSmartImportExerciseLine(
  line: string,
  section: string
): ExerciseForm | null {
  const cleanedLine = line.trim();

  if (!cleanedLine || isSmartImportHeaderLine(cleanedLine)) return null;

  const cells = splitSmartImportRow(cleanedLine);

  if (cells.length >= 3 && /^\d+$/.test(cells[1])) {
    const exerciseName = cells[0];
    const sets = cells[1] || "";
    const reps = cells[2] || "";
    const weight = cells[3] || "";
    const rest = cells[4] || "";
    const trainerNotes = cells.slice(5).join(" ");

    if (!exerciseName || normalizeExerciseName(exerciseName) === "exercise") {
      return null;
    }

    return {
      ...blankExercise(section),
      exerciseName,
      exerciseType: inferExerciseType(reps),
      sets,
      reps,
      weight: /^none$/i.test(weight) ? "" : weight,
      rest: /^none$/i.test(rest) ? "" : rest,
      trainerNotes,
    };
  }

  const regexMatch = cleanedLine.match(
    /^(.+?)\s+(\d+)\s+(.+?)(?:\s+(none|bodyweight|\d+(?:\.\d+)?\s*(?:lb|lbs|kg|pounds?|med(?:icine)?\s*ball|stability\s*ball)))?(?:\s+(none|\d+\s*(?:-|–|to)?\s*\d*\s*(?:sec|secs|s|min|mins|minutes)?))?(?:\s+(.*))?$/i
  );

  if (!regexMatch) return null;

  const [, exerciseName, sets, reps, weight = "", rest = "", notes = ""] =
    regexMatch;

  if (!exerciseName || exerciseName.trim().length < 3) return null;

  return {
    ...blankExercise(section),
    exerciseName: exerciseName.trim(),
    exerciseType: inferExerciseType(reps),
    sets: sets.trim(),
    reps: reps.trim(),
    weight: /^none$/i.test(weight.trim()) ? "" : weight.trim(),
    rest: /^none$/i.test(rest.trim()) ? "" : rest.trim(),
    trainerNotes: notes.trim(),
  };
}

function parseSmartProgramText(rawText: string): WorkoutForm {
  const lines = rawText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const titleLine =
    lines.find((line) => /day\s*\d+/i.test(line)) || "Imported Workout";

  const phaseLine = lines.find((line) => /phase/i.test(line));

  const workoutTitle = phaseLine
    ? `${titleLine.replace(/program$/i, "").trim()} - ${phaseLine}`
    : titleLine;

  let currentSection = "Warm-Up";
  const importedExercises: ExerciseForm[] = [];

  for (const line of lines) {
    const normalized = normalizeExerciseName(line);

    if (normalized.includes("progressive overload") || normalized.includes("6 week")) {
      break;
    }

    const matchedSection = getSmartImportSection(line);

    if (matchedSection && line.length < 80) {
      currentSection = matchedSection;
      continue;
    }

    if (isSmartImportHeaderLine(line)) continue;

    const exercise = parseSmartImportExerciseLine(line, currentSection);

    if (exercise) {
      importedExercises.push(exercise);
    }
  }

  return {
    formId: makeId(),
    title: workoutTitle,
    exercises: importedExercises.length > 0 ? importedExercises : [blankExercise()],
  };
}

export default function CreateProgram() {
  const [searchParams] = useSearchParams();
  const saveDraftTimerRef = useRef<number | null>(null);

  const [currentTrainerUserId, setCurrentTrainerUserId] = useState("");
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibraryItem[]>(
    []
  );
  const [isLoadingExerciseLibrary, setIsLoadingExerciseLibrary] =
    useState(false);

  const [selectedClientId, setSelectedClientId] = useState(
    searchParams.get("client") || ""
  );
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [copySourceClientId, setCopySourceClientId] = useState("");

  const [weekNumber, setWeekNumber] = useState("1");
  const [weekStatus, setWeekStatus] = useState("unlocked");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
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

  const [showSmartImporter, setShowSmartImporter] = useState(false);
  const [smartImportText, setSmartImportText] = useState("");
  const [smartImportMessage, setSmartImportMessage] = useState("");

  const [exerciseHistoryByName, setExerciseHistoryByName] = useState<
    Record<string, ExerciseHistoryItem>
  >({});
  const [selectedExerciseHistory, setSelectedExerciseHistory] =
    useState<ExerciseHistoryItem | null>(null);
  const [isLoadingExerciseHistory, setIsLoadingExerciseHistory] =
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
    loadExerciseLibrary();
    loadHistoricalTemplates();

    return () => {
      if (saveDraftTimerRef.current) {
        window.clearTimeout(saveDraftTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadTrainingPlans(selectedClientId);
      loadClientExerciseHistory(selectedClientId);
      setCopySourceClientId(selectedClientId);
    } else {
      setTrainingPlans([]);
      setSelectedPlanId("");
      setWeekNumber("1");
      setCopySourceClientId("");
      setExistingWorkouts([]);
      setSelectedWorkoutToCopy("");
      setExerciseHistoryByName({});
      setSelectedExerciseHistory(null);
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedClientId && selectedPlanId) {
      loadNextWeekNumber(selectedClientId, selectedPlanId);
      setDraftLoaded(false);
      setDraftSavedAt("");
    } else if (selectedClientId) {
      setWeekNumber("1");
    }
  }, [selectedClientId, selectedPlanId]);

  useEffect(() => {
    if (copySourceClientId) {
      loadExistingWorkouts(copySourceClientId);
    } else {
      setExistingWorkouts([]);
      setSelectedWorkoutToCopy("");
    }
  }, [copySourceClientId]);

  useEffect(() => {
    if (!currentTrainerUserId || !selectedClientId || !selectedPlanId || !weekNumber) {
      setDraftLoaded(false);
      setDraftSavedAt("");
      return;
    }

    loadProgramDraft();
  }, [currentTrainerUserId, selectedClientId, selectedPlanId, weekNumber]);

  useEffect(() => {
    if (
      !currentTrainerUserId ||
      !selectedClientId ||
      !selectedPlanId ||
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
    selectedPlanId,
    weekNumber,
    weekStatus,
    workouts,
    draftLoaded,
    isSaving,
  ]);

  const totalWorkoutCount = workouts.length;

  const totalExerciseCount = workouts.reduce(
    (total, workout) => total + getWorkoutExerciseCount(workout),
    0
  );

  const totalSectionCount = useMemo(() => {
    const sections = new Set<string>();

    workouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        if (exercise.exerciseName.trim()) {
          sections.add(exercise.section || "Other");
        }
      });
    });

    return sections.size;
  }, [workouts]);

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

  async function loadExerciseLibrary() {
    setIsLoadingExerciseLibrary(true);

    const { data, error } = await supabase
      .from("exercise_library")
      .select(
        "id, exercise_name, default_section, movement_pattern, default_sets, default_reps, default_weight, default_rest, video_link, trainer_notes, tags"
      )
      .order("exercise_name", { ascending: true });

    if (error) {
      console.error(error);
      setStatusMessage("Could not load exercise library: " + error.message);
      setExerciseLibrary([]);
      setIsLoadingExerciseLibrary(false);
      return;
    }

    setExerciseLibrary((data || []) as ExerciseLibraryItem[]);
    setIsLoadingExerciseLibrary(false);
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

  async function loadClientExerciseHistory(clientUserId: string) {
    setIsLoadingExerciseHistory(true);
    setSelectedExerciseHistory(null);

    const { data: submissionsData, error: submissionsError } = await supabase
      .from("workout_submissions")
      .select("id, workout_title, submitted_at")
      .eq("client_user_id", clientUserId)
      .order("submitted_at", { ascending: false })
      .limit(150);

    if (submissionsError) {
      console.error(submissionsError);
      setStatusMessage(
        "Could not load this client's submitted exercise history: " +
          submissionsError.message
      );
      setExerciseHistoryByName({});
      setIsLoadingExerciseHistory(false);
      return;
    }

    const submissions = (submissionsData || []) as CompletedWorkoutSubmission[];

    if (submissions.length === 0) {
      setExerciseHistoryByName({});
      setIsLoadingExerciseHistory(false);
      return;
    }

    const submissionIds = submissions.map((submission) => submission.id);

    const { data: exercisesData, error: exercisesError } = await supabase
      .from("workout_submission_exercises")
      .select(
        "id, submission_id, exercise_name, planned_sets, planned_reps, planned_weight, planned_rest, completed, difficulty, notes"
      )
      .in("submission_id", submissionIds);

    if (exercisesError) {
      console.error(exercisesError);
      setStatusMessage(
        "Submitted workouts loaded, but submitted exercise details could not load: " +
          exercisesError.message
      );
      setExerciseHistoryByName({});
      setIsLoadingExerciseHistory(false);
      return;
    }

    const submissionById = new Map(
      submissions.map((submission) => [submission.id, submission])
    );

    const submissionOrder = new Map(
      submissions.map((submission, index) => [submission.id, index])
    );

    const sortedExercises = [
      ...((exercisesData || []) as CompletedWorkoutExercise[]),
    ].sort((a, b) => {
      const aIndex = submissionOrder.get(a.submission_id) ?? 9999;
      const bIndex = submissionOrder.get(b.submission_id) ?? 9999;

      return aIndex - bIndex;
    });

    const historyMap: Record<string, ExerciseHistoryItem> = {};

    sortedExercises.forEach((exercise) => {
      const exerciseName = exercise.exercise_name || "";
      const key = normalizeExerciseName(exerciseName);

      if (!key || historyMap[key]) return;

      const parentSubmission = submissionById.get(exercise.submission_id);

      if (!parentSubmission) return;

      historyMap[key] = {
        exerciseName: exerciseName || "Unnamed Exercise",
        workoutTitle: parentSubmission.workout_title || "Submitted Workout",
        completedAt: parentSubmission.submitted_at,
        sets: exercise.planned_sets || "",
        reps: exercise.planned_reps || "",
        weight: exercise.planned_weight || "",
        rest: exercise.planned_rest || "",
        difficulty: exercise.difficulty || "",
        notes: exercise.notes || "",
      };
    });

    setExerciseHistoryByName(historyMap);
    setIsLoadingExerciseHistory(false);
  }

  function getExerciseHistory(exerciseName: string) {
    const key = normalizeExerciseName(exerciseName);

    if (!key) return null;

    if (exerciseHistoryByName[key]) {
      return exerciseHistoryByName[key];
    }

    const keyWords = key.split(" ").filter((word) => word.length > 2);

    const fuzzyMatch = Object.entries(exerciseHistoryByName).find(
      ([historyKey]) => {
        if (historyKey.includes(key) || key.includes(historyKey)) return true;

        const historyWords = historyKey
          .split(" ")
          .filter((word) => word.length > 2);

        if (keyWords.length === 0 || historyWords.length === 0) return false;

        const overlapCount = keyWords.filter((word) =>
          historyWords.includes(word)
        ).length;

        return overlapCount / keyWords.length >= 0.67;
      }
    );

    return fuzzyMatch?.[1] || null;
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
        "Could not load historical workout templates: " + workoutsError.message
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

  async function loadTrainingPlans(clientUserId: string) {
    setIsLoadingPlans(true);

    const { data, error } = await supabase
      .from("training_plans")
      .select("id, client_user_id, name, plan_type, planned_weeks, status, start_date, created_at")
      .eq("client_user_id", clientUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setTrainingPlans([]);
      setSelectedPlanId("");
      setStatusMessage("Could not load this client's training plans: " + error.message);
      setIsLoadingPlans(false);
      return;
    }

    const plans = (data || []) as TrainingPlan[];
    setTrainingPlans(plans);

    const requestedPlanId = searchParams.get("plan");
    const requestedPlan = requestedPlanId
      ? plans.find((plan) => plan.id === requestedPlanId)
      : null;

    const preferredPlan =
      requestedPlan ||
      plans.find((plan) => plan.status === "active") ||
      plans.find((plan) => plan.status === "draft") ||
      plans[0];

    setSelectedPlanId((current) =>
      current && plans.some((plan) => plan.id === current)
        ? current
        : preferredPlan?.id || ""
    );

    setIsLoadingPlans(false);
  }

  async function loadNextWeekNumber(clientUserId: string, planId: string) {
    setIsLoadingWeek(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from("client_plan_weeks")
      .select("week_number")
      .eq("client_user_id", clientUserId)
      .eq("plan_id", planId)
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
            trainer_notes,
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

  function handleClientChange(value: string) {
    setSelectedClientId(value);
    setSelectedPlanId("");
    setTrainingPlans([]);
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

  function addWorkout() {
    setWorkouts((currentWorkouts) => [...currentWorkouts, blankWorkout()]);
  }

  function importSmartProgramText() {
    setSmartImportMessage("");

    if (!smartImportText.trim()) {
      setSmartImportMessage("Paste the workout program text first.");
      return;
    }

    const importedWorkout = parseSmartProgramText(smartImportText);
    const importedExerciseCount = getWorkoutExerciseCount(importedWorkout);

    if (importedExerciseCount === 0) {
      setSmartImportMessage(
        "I could not find exercises in that program text. Try copying the table text from Word or Google Docs and paste it again."
      );
      return;
    }

    addCopiedWorkoutToForm(importedWorkout);
    setSmartImportText("");
    setShowSmartImporter(false);
    setStatusMessage(
      `Imported "${importedWorkout.title}" with ${importedExerciseCount} exercise${
        importedExerciseCount === 1 ? "" : "s"
      }. Review it, then save the program week.`
    );
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
      exercises:
        workoutToCopy.client_plan_exercises.length > 0
          ? workoutToCopy.client_plan_exercises.map((exercise) => ({
              formId: makeId(),
              section: exercise.section || "Resistance Training",
              exerciseName: exercise.exercise_name || "",
              exerciseType: inferExerciseType(exercise.reps),
              sets: exercise.sets || "",
              reps: exercise.reps || "",
              weight: exercise.weight || "",
              rest: exercise.rest || "",
              videoLink: exercise.video_link || "",
              trainerNotes: exercise.trainer_notes || "",
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
                exerciseType: inferExerciseType(exercise.reps),
                sets: exercise.sets || "",
                reps: exercise.reps || "",
                weight: exercise.weight || "",
                rest: exercise.rest || "",
                videoLink: "",
                trainerNotes: exercise.notes || exercise.original_line || "",
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

  function applyExerciseFromLibrary(
    workoutIndex: number,
    exerciseIndex: number,
    libraryExerciseId: string
  ) {
    if (!libraryExerciseId) return;

    const libraryExercise = exerciseLibrary.find(
      (exercise) => exercise.id === libraryExerciseId
    );

    if (!libraryExercise) {
      setStatusMessage("Could not find that exercise in the library.");
      return;
    }

    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, currentWorkoutIndex) => {
        if (currentWorkoutIndex !== workoutIndex) return workout;

        return {
          ...workout,
          exercises: workout.exercises.map((exercise, currentExerciseIndex) => {
            if (currentExerciseIndex !== exerciseIndex) return exercise;

            return {
              ...exercise,
              section:
                libraryExercise.default_section ||
                exercise.section ||
                "Resistance Training",
              exerciseName: libraryExercise.exercise_name || exercise.exerciseName,
              exerciseType: inferExerciseType(libraryExercise.default_reps),
              sets: libraryExercise.default_sets || exercise.sets,
              reps: libraryExercise.default_reps || exercise.reps,
              weight: libraryExercise.default_weight || exercise.weight,
              rest: libraryExercise.default_rest || exercise.rest,
              videoLink: libraryExercise.video_link ?? "",
              trainerNotes:
                libraryExercise.trainer_notes || exercise.trainerNotes,
            };
          }),
        };
      })
    );

    setStatusMessage(`Added "${libraryExercise.exercise_name}" from library.`);
  }

  async function saveExerciseToLibrary(exercise: ExerciseForm) {
    if (!currentTrainerUserId) {
      setStatusMessage("You must be logged in as a trainer to save exercises.");
      return;
    }

    if (!exercise.exerciseName.trim()) {
      setStatusMessage("Add an exercise name before saving to the library.");
      return;
    }

    const { error } = await supabase.from("exercise_library").insert({
      trainer_user_id: currentTrainerUserId,
      exercise_name: exercise.exerciseName.trim(),
      default_section: exercise.section,
      default_sets: exercise.sets.trim(),
      default_reps: exercise.reps.trim(),
      default_weight: exercise.weight.trim(),
      default_rest: exercise.rest.trim(),
      video_link: exercise.videoLink.trim(),
      trainer_notes: exercise.trainerNotes.trim(),
      movement_pattern: "",
      tags: [],
    });

    if (error) {
      if (error.message.toLowerCase().includes("duplicate")) {
        setStatusMessage("That exercise is already in your library.");
      } else {
        setStatusMessage("Could not save exercise to library: " + error.message);
      }

      return;
    }

    setStatusMessage(`"${exercise.exerciseName}" saved to your exercise library.`);
    await loadExerciseLibrary();
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
    if (!selectedClientId || !selectedPlanId || !weekNumber) return false;

    return workouts.some((workout) => {
      const hasWorkoutText = workout.title.trim() !== "";

      const hasExerciseText = workout.exercises.some(
        (exercise) =>
          exercise.exerciseName.trim() !== "" ||
          exercise.sets.trim() !== "" ||
          exercise.reps.trim() !== "" ||
          exercise.weight.trim() !== "" ||
          exercise.rest.trim() !== "" ||
          exercise.videoLink.trim() !== "" ||
          exercise.trainerNotes.trim() !== ""
      );

      return hasWorkoutText || hasExerciseText;
    });
  }

  async function loadProgramDraft() {
    if (!currentTrainerUserId || !selectedClientId || !selectedPlanId || !weekNumber) return;

    setDraftLoaded(false);

    const targetWeekNumber = Number(weekNumber);

    if (!targetWeekNumber || targetWeekNumber < 1) {
      setDraftLoaded(true);
      return;
    }

    const { data, error } = await supabase
      .from("trainer_program_drafts")
      .select(
        "id, trainer_user_id, target_client_user_id, plan_id, week_number, week_status, draft_data, updated_at"
      )
      .eq("trainer_user_id", currentTrainerUserId)
      .eq("target_client_user_id", selectedClientId)
      .eq("plan_id", selectedPlanId)
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
            exercises:
              workout.exercises && workout.exercises.length > 0
                ? workout.exercises.map((exercise) => ({
                    formId: exercise.formId || makeId(),
                    section: exercise.section || "Resistance Training",
                    exerciseName: exercise.exerciseName || "",
                    exerciseType:
                      exercise.exerciseType || inferExerciseType(exercise.reps),
                    sets: exercise.sets || "",
                    reps: exercise.reps || "",
                    weight: exercise.weight || "",
                    rest: exercise.rest || "",
                    videoLink: exercise.videoLink || "",
                    trainerNotes: exercise.trainerNotes || "",
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
    if (!currentTrainerUserId || !selectedClientId || !selectedPlanId || !weekNumber) return;

    const targetWeekNumber = Number(weekNumber);

    if (!targetWeekNumber || targetWeekNumber < 1) return;

    setIsSavingDraft(true);

    const now = new Date().toISOString();

    const draftPayload = {
      trainer_user_id: currentTrainerUserId,
      target_client_user_id: selectedClientId,
      plan_id: selectedPlanId,
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
      .eq("plan_id", selectedPlanId)
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
    if (!currentTrainerUserId || !selectedClientId || !selectedPlanId || !weekToClear) return;

    const targetWeekNumber = Number(weekToClear);

    if (!targetWeekNumber || targetWeekNumber < 1) return;

    await supabase
      .from("trainer_program_drafts")
      .delete()
      .eq("trainer_user_id", currentTrainerUserId)
      .eq("target_client_user_id", selectedClientId)
      .eq("plan_id", selectedPlanId)
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

    if (!selectedPlanId) {
      setStatusMessage("Please select a training plan. Create one in Training Plans if needed.");
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
            trainerNotes: exercise.trainerNotes.trim(),
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

    const targetPlan = trainingPlans.find((plan) => plan.id === selectedPlanId);
    if (
      targetPlan?.plan_type === "fixed" &&
      targetPlan.planned_weeks &&
      targetWeekNumber > targetPlan.planned_weeks
    ) {
      setStatusMessage(
        `${targetPlan.name} is a ${targetPlan.planned_weeks}-week plan. Choose Week 1-${targetPlan.planned_weeks} or extend/start a new plan.`
      );
      setIsSaving(false);
      return;
    }

    const { data: existingWeek, error: existingWeekError } = await supabase
      .from("client_plan_weeks")
      .select("id")
      .eq("client_user_id", selectedClientId)
      .eq("plan_id", selectedPlanId)
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
          plan_id: selectedPlanId,
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
        trainer_notes: exercise.trainerNotes,
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
  const selectedPlan = trainingPlans.find((plan) => plan.id === selectedPlanId);
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
      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-6 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-8 sm:rounded-[2rem]">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-600 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Guided Program Builder
                </p>

                <h1 className="mt-3 break-words text-3xl font-black leading-tight md:text-5xl">
                  Create Client Program
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-blue-50 sm:text-base">
                  Build workouts exactly how clients will experience them:
                  section by section, movement by movement, set by set.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {selectedClientId && (
                  <Link
                    to={`/clients/${selectedClientId}`}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:w-auto"
                  >
                    View Client
                  </Link>
                )}

                <Link
                  to="/trainer"
                  className="w-full rounded-2xl bg-white/15 px-4 py-3 text-center text-sm font-black text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:p-6 md:grid-cols-4 md:p-8">
            <SummaryCard title="Workouts" value={String(totalWorkoutCount)} />
            <SummaryCard title="Exercises" value={String(totalExerciseCount)} />
            <SummaryCard title="Sections Used" value={String(totalSectionCount)} />
            <SummaryCard
              title="Plan"
              value={selectedPlan?.name || "Select plan"}
            />
          </div>
        </div>

        <form
          onSubmit={saveProgram}
          className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6"
        >
          <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50 p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Program Setup
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Choose client, plan, and week
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Target Client
                </label>

                <select
                  value={selectedClientId}
                  onChange={(event) => handleClientChange(event.target.value)}
                  className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select target client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name} — {client.client_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Training Plan
                </label>

                <select
                  value={selectedPlanId}
                  onChange={(event) => setSelectedPlanId(event.target.value)}
                  disabled={!selectedClientId || isLoadingPlans}
                  className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {isLoadingPlans ? "Loading plans..." : "Select training plan"}
                  </option>
                  {trainingPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {plan.status}
                      {plan.planned_weeks ? ` — ${plan.planned_weeks} weeks` : ""}
                    </option>
                  ))}
                </select>

                {selectedClientId && (
                  <Link
                    to={`/training-plans?client=${selectedClientId}`}
                    className="mt-2 inline-block text-xs font-black text-blue-700 hover:text-blue-900"
                  >
                    Manage / create plans →
                  </Link>
                )}
              </div>

              <Input
                label={isLoadingWeek ? "Week Number Loading..." : "Week Number"}
                value={weekNumber}
                onChange={setWeekNumber}
                placeholder="1"
                type="number"
              />

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Week Status
                </label>

                <select
                  value={weekStatus}
                  onChange={(event) => setWeekStatus(event.target.value)}
                  className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="unlocked">Unlocked</option>
                  <option value="locked">Locked</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {selectedClient && (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-blue-700">
                    Target Client
                  </p>

                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                    This workout/week will be saved to {selectedClient.full_name} —{" "}
                    {selectedClient.client_id}
                    {selectedPlan ? ` inside ${selectedPlan.name}` : ""}. If Week {weekNumber}
                    already exists in this plan, the workout will be added into that week.
                  </p>

                  <p className="mt-2 text-xs font-bold text-blue-700">
                    {isLoadingExerciseHistory
                      ? "Loading submitted exercise history..."
                      : `${Object.keys(exerciseHistoryByName).length} submitted exercise result${
                          Object.keys(exerciseHistoryByName).length === 1
                            ? ""
                            : "s"
                        } loaded for this client.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => loadClientExerciseHistory(selectedClient.id)}
                  disabled={isLoadingExerciseHistory}
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh Submitted History
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-[1.5rem] border border-indigo-100 bg-indigo-50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                  Smart Program Import
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Paste a program from Word or Google Docs
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Paste a workout table like Alex's NASM progression document,
                  and CoachSync will build the exercise cards for you.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSmartImporter((current) => !current)}
                className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition hover:bg-indigo-700"
              >
                {showSmartImporter ? "Hide Importer" : "Open Importer"}
              </button>
            </div>

            {showSmartImporter && (
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-white p-4">
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Paste Program Text
                </label>

                <textarea
                  value={smartImportText}
                  onChange={(event) => setSmartImportText(event.target.value)}
                  rows={10}
                  placeholder={`Example:\nWarm-Up\nFoam Roll    1    30s    None    None\nActivation (core/balance)\nDead Bug    2    8-10 reps    None    10-15 sec\nResistance Training\nSeated Chest Press    2    12-15 reps    30 lbs    60-120 sec`}
                  className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />

                {smartImportMessage && (
                  <p className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-700">
                    {smartImportMessage}
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={importSmartProgramText}
                    className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition hover:bg-indigo-700"
                  >
                    Import Into Program Builder
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSmartImportText("");
                      setSmartImportMessage("");
                    }}
                    className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {selectedClientId && (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-emerald-700">
                    Draft Autosave
                  </p>

                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                    {isSavingDraft
                      ? "Saving program draft..."
                      : draftSavedAt
                      ? `Draft saved at ${new Date(
                          draftSavedAt
                        ).toLocaleTimeString([], {
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
                  className="rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear Draft
                </button>
              </div>
            </div>
          )}

          {selectedClientId && (
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                      Copy Assigned Workout
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-900">
                      Use existing workout
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Copy a previous assigned workout, then edit it before
                      saving.
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
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-50"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Copy From Client
                  </label>

                  <select
                    value={copySourceClientId}
                    onChange={(event) =>
                      setCopySourceClientId(event.target.value)
                    }
                    className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select source client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.full_name} — {client.client_id}
                      </option>
                    ))}
                  </select>

                  {copySourceClient && (
                    <p className="mt-2 text-sm font-semibold text-slate-600">
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
                        <label className="mb-2 block text-sm font-black text-slate-700">
                          Select Workout
                        </label>

                        <select
                          value={selectedWorkoutToCopy}
                          onChange={(event) =>
                            setSelectedWorkoutToCopy(event.target.value)
                          }
                          className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
                        className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {existingWorkouts.slice(0, 4).map((workout) => (
                        <button
                          key={workout.id}
                          type="button"
                          onClick={() => copyWorkoutById(workout.id)}
                          className="rounded-2xl border border-blue-100 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                            {workout.source_client_name} • Week{" "}
                            {workout.week_number}
                          </p>

                          <h3 className="mt-1 font-black text-slate-900">
                            {workout.title}
                          </h3>

                          <p className="mt-1 text-sm font-semibold text-slate-500">
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

              <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">
                      Historical Templates
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-900">
                      Use imported workout
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Copy a historical workout into this guided program.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={loadHistoricalTemplates}
                    className="rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm font-black text-amber-700 transition hover:bg-amber-50"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700">
                      Filter by Client
                    </label>

                    <select
                      value={selectedHistoricalClientId}
                      onChange={(event) => {
                        setSelectedHistoricalClientId(event.target.value);
                        setSelectedHistoricalTemplateId("");
                      }}
                      className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
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
                    <label className="mb-2 block text-sm font-black text-slate-700">
                      Select Template
                    </label>

                    <select
                      value={selectedHistoricalTemplateId}
                      onChange={(event) =>
                        setSelectedHistoricalTemplateId(event.target.value)
                      }
                      className="w-full rounded-2xl border border-amber-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
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
                    No imported historical workouts found yet.
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
                      className="mb-4 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-600"
                    >
                      Copy Selected Template
                    </button>

                    <div className="grid gap-3">
                      {filteredHistoricalTemplates
                        .slice(0, 4)
                        .map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() =>
                              copyHistoricalTemplateById(template.id)
                            }
                            className="rounded-2xl border border-amber-100 bg-white p-4 text-left transition hover:border-amber-200 hover:bg-amber-50"
                          >
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                              {getClientName(template.client_id)} •{" "}
                              {formatDate(template.workout_date)}
                            </p>

                            <h3 className="mt-1 font-black text-slate-900">
                              {template.title || "Untitled Past Workout"}
                            </h3>

                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              {
                                template.client_historical_workout_exercises
                                  .length
                              }{" "}
                              exercise
                              {template.client_historical_workout_exercises
                                .length === 1
                                ? ""
                                : "s"}
                            </p>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mt-8">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                  Guided Sessions
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  Workouts / Sessions
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Build each workout by section so the client sees warm-up,
                  activation, SAQ, resistance, and cool-down in the correct flow.
                </p>
              </div>

              <button
                type="button"
                onClick={addWorkout}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700"
              >
                Add Workout
              </button>
            </div>

            <div className="space-y-6">
              {workouts.map((workout, workoutIndex) => (
                <div
                  key={workout.formId}
                  className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-sky-50 shadow-sm sm:rounded-[2rem]"
                >
                  <div className="border-b border-sky-100 bg-white p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                          Workout {workoutIndex + 1}
                        </p>

                        <h3 className="mt-1 break-words text-2xl font-black text-slate-900">
                          {workout.title.trim() || "Untitled Workout"}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-sky-100">
                            {getWorkoutExerciseCount(workout)} exercises
                          </span>

                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-sky-100">
                            {getWorkoutSectionCount(workout)} sections
                          </span>

                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                            Guided-ready
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => duplicateWorkoutInForm(workoutIndex)}
                          className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-black text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50"
                        >
                          Duplicate
                        </button>

                        <button
                          type="button"
                          onClick={() => removeWorkout(workoutIndex)}
                          className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-5">
                      <Input
                        label="Workout Title"
                        value={workout.title}
                        onChange={(value) =>
                          updateWorkoutTitle(workoutIndex, value)
                        }
                        placeholder="Day 1 Stabilization Endurance"
                      />
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="mb-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h4 className="text-lg font-black text-slate-900">
                            Add exercises by section
                          </h4>

                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            These are the same section headings the client will
                            see in the guided workout.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {WORKOUT_SECTIONS.map((section) => (
                            <button
                              key={section}
                              type="button"
                              onClick={() => addExercise(workoutIndex, section)}
                              className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-50"
                            >
                              + {section}
                            </button>
                          ))}
                        </div>
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
                        <div className="space-y-5">
                          {WORKOUT_SECTIONS.map((section) => {
                            const sectionExercises = workout.exercises
                              .map((exercise, originalIndex) => ({
                                exercise,
                                originalIndex,
                              }))
                              .filter(
                                (item) => item.exercise.section === section
                              );

                            const completedSectionExercises =
                              sectionExercises.filter(({ exercise }) =>
                                exercise.exerciseName.trim()
                              );

                            if (sectionExercises.length === 0) {
                              return (
                                <EmptySectionCard
                                  key={section}
                                  section={section}
                                  workoutIndex={workoutIndex}
                                  addExercise={addExercise}
                                />
                              );
                            }

                            return (
                              <div
                                key={section}
                                className="overflow-hidden rounded-[1.5rem] border border-sky-100 bg-white shadow-sm"
                              >
                                <div className="border-b border-sky-100 bg-gradient-to-br from-white via-sky-50 to-blue-50 p-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                                        Client Section Intro
                                      </p>

                                      <h5 className="mt-1 text-xl font-black text-slate-900">
                                        {section}
                                      </h5>

                                      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                                        {SECTION_DESCRIPTIONS[section] ||
                                          "Section exercises for this workout."}
                                      </p>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:items-end">
                                      <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-sky-100">
                                        {completedSectionExercises.length} added
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          addExercise(workoutIndex, section)
                                        }
                                        className="rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-700"
                                      >
                                        Add to {section}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-4 p-4">
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
                                        exerciseLibrary={exerciseLibrary}
                                        isLoadingExerciseLibrary={
                                          isLoadingExerciseLibrary
                                        }
                                        applyExerciseFromLibrary={
                                          applyExerciseFromLibrary
                                        }
                                        saveExerciseToLibrary={
                                          saveExerciseToLibrary
                                        }
                                        getExerciseHistory={getExerciseHistory}
                                        setSelectedExerciseHistory={
                                          setSelectedExerciseHistory
                                        }
                                        isLoadingExerciseHistory={
                                          isLoadingExerciseHistory
                                        }
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
            <p className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold leading-6 text-slate-700">
              {statusMessage}
            </p>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="w-full rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              Preview Client Experience
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving Program..." : "Save Program Week / Add to Week"}
            </button>
          </div>

          {showPreview && (
            <WorkoutPreviewModal
              workouts={workouts}
              weekNumber={weekNumber}
              selectedClientName={selectedClient?.full_name || ""}
              onClose={() => setShowPreview(false)}
            />
          )}

          {selectedExerciseHistory && (
            <ExerciseHistoryModal
              history={selectedExerciseHistory}
              onClose={() => setSelectedExerciseHistory(null)}
            />
          )}
        </form>
      </section>
    </main>
  );
}

function EmptySectionCard({
  section,
  workoutIndex,
  addExercise,
}: {
  section: string;
  workoutIndex: number;
  addExercise: (workoutIndex: number, section: string) => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-sky-200 bg-white/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Empty Section
          </p>

          <h5 className="mt-1 text-lg font-black text-slate-700">{section}</h5>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {SECTION_DESCRIPTIONS[section] ||
              "Add an exercise here if this section belongs in the workout."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => addExercise(workoutIndex, section)}
          className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50"
        >
          + Add Exercise
        </button>
      </div>
    </div>
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
  exerciseLibrary,
  isLoadingExerciseLibrary,
  applyExerciseFromLibrary,
  saveExerciseToLibrary,
  getExerciseHistory,
  setSelectedExerciseHistory,
  isLoadingExerciseHistory,
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
  exerciseLibrary: ExerciseLibraryItem[];
  isLoadingExerciseLibrary: boolean;
  applyExerciseFromLibrary: (
    workoutIndex: number,
    exerciseIndex: number,
    libraryExerciseId: string
  ) => void;
  saveExerciseToLibrary: (exercise: ExerciseForm) => void;
  getExerciseHistory: (exerciseName: string) => ExerciseHistoryItem | null;
  setSelectedExerciseHistory: (history: ExerciseHistoryItem | null) => void;
  isLoadingExerciseHistory: boolean;
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

  const hasExerciseName = exercise.exerciseName.trim() !== "";
  const exerciseHistory = hasExerciseName
    ? getExerciseHistory(exercise.exerciseName)
    : null;

  const summaryParts = [
    exercise.section,
    exercise.sets ? `${exercise.sets} sets` : "",
    exercise.reps ? exercise.reps : "",
    exercise.weight ? exercise.weight : "",
    exercise.rest ? `${exercise.rest} rest` : "",
  ].filter(Boolean);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-[1.35rem] border bg-white transition ${
        isDragging
          ? "z-20 border-blue-200 opacity-80 shadow-xl ring-2 ring-blue-200"
          : hasExerciseName
          ? "border-sky-100 shadow-sm"
          : "border-dashed border-slate-200"
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

              <h5 className="mt-1 break-words text-lg font-black text-slate-900">
                {exercise.exerciseName.trim() || "New Exercise"}
              </h5>

              <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-500">
                {summaryParts.length > 0
                  ? summaryParts.join(" • ")
                  : "Add exercise details to make this guided-workout ready."}
              </p>

              {exercise.trainerNotes.trim() && !isExpanded && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                  Note: {exercise.trainerNotes}
                </p>
              )}

              {exerciseHistory && !isExpanded && (
                <button
                  type="button"
                  onClick={() => setSelectedExerciseHistory(exerciseHistory)}
                  className="mt-3 w-full rounded-2xl border border-amber-100 bg-amber-50 p-3 text-left transition hover:bg-amber-100"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                    Last Submitted Result
                  </p>

                  <p className="mt-1 text-sm font-black text-slate-900">
                    {formatDate(exerciseHistory.completedAt)} • {exerciseHistory.sets || "N/A"} sets • {exerciseHistory.reps || "N/A"}
                    {exerciseHistory.weight ? ` • ${exerciseHistory.weight}` : ""}
                  </p>

                  {exerciseHistory.notes && (
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                      Client note: {exerciseHistory.notes}
                    </p>
                  )}
                </button>
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
              onClick={() => moveExercise(workoutIndex, exerciseIndex, "up")}
              disabled={exerciseIndex === 0}
              className="rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Up
            </button>

            <button
              type="button"
              onClick={() => moveExercise(workoutIndex, exerciseIndex, "down")}
              disabled={exerciseIndex === totalExercises - 1}
              className="rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Down
            </button>

            <button
              type="button"
              onClick={() => removeExercise(workoutIndex, exerciseIndex)}
              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-sky-100 bg-sky-50/60 p-4">
          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Choose Exercise From Library
                </label>

                <select
                  value=""
                  onChange={(event) =>
                    applyExerciseFromLibrary(
                      workoutIndex,
                      exerciseIndex,
                      event.target.value
                    )
                  }
                  disabled={isLoadingExerciseLibrary}
                  className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {isLoadingExerciseLibrary
                      ? "Loading exercise library..."
                      : "Search/choose an exercise to auto-fill this tile"}
                  </option>

                  {WORKOUT_SECTIONS.map((section) => {
                    const sectionExercises = exerciseLibrary.filter(
                      (libraryExercise) =>
                        (libraryExercise.default_section || "Other") ===
                        section
                    );

                    if (sectionExercises.length === 0) return null;

                    return (
                      <optgroup key={section} label={section}>
                        {sectionExercises.map((libraryExercise) => (
                          <option
                            key={libraryExercise.id}
                            value={libraryExercise.id}
                          >
                            {libraryExercise.exercise_name}
                            {libraryExercise.default_reps
                              ? ` — ${libraryExercise.default_reps}`
                              : ""}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>

                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  Auto-fills section, sets, reps, weight, rest, video link, and
                  notes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => saveExerciseToLibrary(exercise)}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-50"
              >
                Save This Exercise
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
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
                className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {WORKOUT_SECTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Exercise Name"
                value={exercise.exerciseName}
                onChange={(value) =>
                  updateExercise(
                    workoutIndex,
                    exerciseIndex,
                    "exerciseName",
                    value
                  )
                }
                placeholder="Band Pull Aparts"
              />

              {exercise.exerciseName.trim() && (
                <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  {isLoadingExerciseHistory ? (
                    <p className="text-xs font-bold text-amber-700">
                      Loading submitted result...
                    </p>
                  ) : exerciseHistory ? (
                    <button
                      type="button"
                      onClick={() => setSelectedExerciseHistory(exerciseHistory)}
                      className="w-full text-left"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                        Last Submitted Result Found
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-900">
                        {formatDate(exerciseHistory.completedAt)} • {exerciseHistory.weight || "No weight"}
                      </p>

                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                        Click to view sets, reps/time, weight, difficulty, and notes.
                      </p>
                    </button>
                  ) : (
                    <p className="text-xs font-bold text-slate-500">
                      No submitted result found for this exercise yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Input
              label="Sets"
              value={exercise.sets}
              onChange={(value) =>
                updateExercise(workoutIndex, exerciseIndex, "sets", value)
              }
              placeholder="2"
            />

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Exercise Type
              </label>

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-sky-100 bg-white p-2">
                <button
                  type="button"
                  onClick={() =>
                    updateExercise(
                      workoutIndex,
                      exerciseIndex,
                      "exerciseType",
                      "reps"
                    )
                  }
                  className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                    exercise.exerciseType === "reps"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-sky-50 text-slate-600 hover:bg-blue-50"
                  }`}
                >
                  Reps
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateExercise(
                      workoutIndex,
                      exerciseIndex,
                      "exerciseType",
                      "timed"
                    )
                  }
                  className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                    exercise.exerciseType === "timed"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-sky-50 text-slate-600 hover:bg-blue-50"
                  }`}
                >
                  Timed
                </button>
              </div>
            </div>

            <Input
              label={exercise.exerciseType === "timed" ? "Time" : "Reps"}
              value={exercise.reps}
              onChange={(value) =>
                updateExercise(workoutIndex, exerciseIndex, "reps", value)
              }
              placeholder={
                exercise.exerciseType === "timed" ? "30 sec or 1 min" : "10 reps"
              }
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

            <div className="md:col-span-3">
              <label className="mb-2 block text-sm font-black text-slate-700">
                Trainer Notes
              </label>

              <textarea
                value={exercise.trainerNotes}
                onChange={(event) =>
                  updateExercise(
                    workoutIndex,
                    exerciseIndex,
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


function ExerciseHistoryModal({
  history,
  onClose,
}: {
  history: ExerciseHistoryItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-lg rounded-[2rem] border border-sky-100 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
              Last Submitted Exercise
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-900">
              {history.exerciseName}
            </h2>

            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              {formatDate(history.completedAt)} • {history.workoutTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <HistoryStat label="Sets" value={history.sets || "N/A"} />
          <HistoryStat label="Reps / Time" value={history.reps || "N/A"} />
          <HistoryStat label="Weight" value={history.weight || "N/A"} />
          <HistoryStat label="Rest" value={history.rest || "N/A"} />
        </div>

        {history.difficulty && (
          <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <p className="text-xs font-black uppercase text-orange-700">
              Client Difficulty
            </p>
            <p className="mt-1 text-sm font-bold text-orange-800">
              {history.difficulty}
            </p>
          </div>
        )}

        {history.notes && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">
              Client Notes
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {history.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-sky-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}


function WorkoutPreviewModal({
  workouts,
  weekNumber,
  selectedClientName,
  onClose,
}: {
  workouts: WorkoutForm[];
  weekNumber: string;
  selectedClientName: string;
  onClose: () => void;
}) {
  const validWorkouts = workouts.filter(
    (workout) =>
      workout.title.trim() !== "" ||
      workout.exercises.some((exercise) => exercise.exerciseName.trim() !== "")
  );

  const totalExercises = validWorkouts.reduce(
    (total, workout) => total + getWorkoutExerciseCount(workout),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-600 px-5 py-6 text-white sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
                Client Experience Preview
              </p>

              <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                Week {weekNumber || "1"} Preview
              </h2>

              <p className="mt-2 text-sm font-semibold leading-6 text-blue-50">
                {selectedClientName
                  ? `Previewing how ${selectedClientName} will experience this program.`
                  : "Preview how the client will experience this program."}
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
                Workouts
              </p>
              <p className="mt-1 text-2xl font-black">{validWorkouts.length}</p>
            </div>

            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                Exercises
              </p>
              <p className="mt-1 text-2xl font-black">{totalExercises}</p>
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
          {validWorkouts.length === 0 ? (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
              <h3 className="text-xl font-black text-red-700">
                Nothing to preview yet
              </h3>

              <p className="mt-2 text-sm font-semibold leading-6 text-red-600">
                Add a workout title and at least one exercise before previewing.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {validWorkouts.map((workout, workoutIndex) => {
                const issues = getWorkoutPreviewIssues(workout);

                return (
                  <div
                    key={workout.formId}
                    className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-sky-50 shadow-sm"
                  >
                    <div className="border-b border-sky-100 bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                        Workout {workoutIndex + 1}
                      </p>

                      <h3 className="mt-1 text-2xl font-black text-slate-900">
                        {workout.title.trim() || "Untitled Workout"}
                      </h3>

                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {getWorkoutExerciseCount(workout)} exercises • {" "}
                        {getWorkoutSectionCount(workout)} sections
                      </p>
                    </div>

                    <div className="p-5">
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

                      <div className="space-y-5">
                        {WORKOUT_SECTIONS.map((section) => {
                          const sectionExercises = workout.exercises.filter(
                            (exercise) =>
                              exercise.section === section &&
                              exercise.exerciseName.trim() !== ""
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
    <div className="rounded-2xl border
    border-sky-100 bg-sky-50 p-4 sm:p-5">
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