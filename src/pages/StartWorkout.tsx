import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

const SECTION_ORDER = [
  "Warm-Up",
  "Warmup",
  "Warm Up",
  "Activation / Core / Balance",
  "Core Activation",
  "Core and Activation",
  "Activation",
  "Balance",
  "SAQ / Skill Development",
  "SAQ",
  "Skill Development",
  "Resistance Training",
  "Resistance",
  "Cool-Down",
  "Cooldown",
  "Cool Down",
  "Workout",
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
  completedSetCounts?: Record<string, number>;
  activeStepIndex?: number;
  activeSetNumber?: number;
  showSectionIntro?: boolean;
  showFinalReview?: boolean;
  painReported?: boolean;
  painLocation?: string;
  painLevel?: string;
  painExercise?: string;
  painNotes?: string;
};

type WorkoutDraftRow = {
  id: string;
  client_user_id: string;
  workout_id: string;
  workout_notes: string | null;
  draft_data: WorkoutDraftData | null;
  updated_at: string;
};

type GuidedStep = {
  exercise: LoggedExercise;
  originalIndex: number;
};

function normalizeSection(section: string | null | undefined) {
  const cleaned = (section || "").trim();

  if (!cleaned) return "Other";

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

  return cleaned;
}

function parseSets(value: string) {
  if (!value) return 1;

  const directNumber = Number(value);

  if (!Number.isNaN(directNumber) && directNumber > 0) {
    return Math.round(directNumber);
  }

  const match = value.match(/\d+/);

  if (!match) return 1;

  const parsed = Number(match[0]);

  if (Number.isNaN(parsed) || parsed <= 0) return 1;

  return Math.round(parsed);
}

function parseRestSeconds(value: string) {
  if (!value) return 60;

  const lower = value.toLowerCase();
  const match = lower.match(/\d+/);

  if (!match) return 60;

  const number = Number(match[0]);

  if (Number.isNaN(number) || number <= 0) return 60;

  if (lower.includes("min")) {
    return number * 60;
  }

  return number;
}

function parseExerciseDurationSeconds(value: string) {
  if (!value) return 0;

  const lower = value.toLowerCase();

  const minuteMatch = lower.match(/(\d+)\s*(min|mins|minute|minutes)/);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);
    return Number.isNaN(minutes) ? 0 : minutes * 60;
  }

  const secondMatch = lower.match(/(\d+)\s*(sec|secs|second|seconds|s)\b/);
  if (secondMatch) {
    const seconds = Number(secondMatch[1]);
    return Number.isNaN(seconds) ? 0 : seconds;
  }

  return 0;
}

function getTimedExerciseSeconds(exercise: LoggedExercise | undefined) {
  if (!exercise) return 0;

  return parseExerciseDurationSeconds(exercise.plannedReps);
}

function isTimedExercise(exercise: LoggedExercise | undefined) {
  return getTimedExerciseSeconds(exercise) > 0;
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function StartWorkout({
  previewMode = false,
  previewWorkoutId,
  previewClientUserId,
  previewBasePath,
}: {
  previewMode?: boolean;
  previewWorkoutId?: string;
  previewClientUserId?: string;
  previewBasePath?: string;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const workoutId = previewWorkoutId || searchParams.get("workoutId");
  const isRepeatMode = searchParams.get("repeat") === "true";
  const trainerPreviewMode =
    previewMode && !!previewClientUserId && !!previewBasePath;
  const previewExitPath = previewBasePath
    ? `${previewBasePath}/plan`
    : "/client-plan";

  const saveTimerRef = useRef<number | null>(null);
  const restCountdownSpokenRef = useRef<number | null>(null);
  const exerciseCountdownSpokenRef = useRef<number | null>(null);
  const preStartSpokenRef = useRef<number | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");
  const [workout, setWorkout] = useState<PlanWorkout | null>(null);
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
  const [completedSetCounts, setCompletedSetCounts] = useState<
    Record<string, number>
  >({});

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeSetNumber, setActiveSetNumber] = useState(1);

  const [isResting, setIsResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(60);
  const [exerciseSeconds, setExerciseSeconds] = useState(0);
  const [isExerciseTimerRunning, setIsExerciseTimerRunning] = useState(false);
  const [audioCountdownEnabled, setAudioCountdownEnabled] = useState(true);
  const [isPreStartRunning, setIsPreStartRunning] = useState(false);
  const [preStartSeconds, setPreStartSeconds] = useState(0);

  const [showSectionIntro, setShowSectionIntro] = useState(true);
  const [showFinalReview, setShowFinalReview] = useState(false);
  const [showExerciseDetails, setShowExerciseDetails] = useState(false);

  const [workoutNotes, setWorkoutNotes] = useState("");

  const [painReported, setPainReported] = useState(false);
  const [painLocation, setPainLocation] = useState("");
  const [painLevel, setPainLevel] = useState("");
  const [painExercise, setPainExercise] = useState("");
  const [painNotes, setPainNotes] = useState("");

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
  }, [workoutId, isRepeatMode, previewMode, previewClientUserId]);

  useEffect(() => {
    if (!isResting) return;

    if (restSeconds <= 0) {
      finishRest();
      return;
    }

    if (
      restSeconds <= 5 &&
      restSeconds > 0 &&
      restCountdownSpokenRef.current !== restSeconds
    ) {
      restCountdownSpokenRef.current = restSeconds;
      playAudioCountdown(restSeconds);
    }

    const timer = window.setTimeout(() => {
      setRestSeconds((currentSeconds) => currentSeconds - 1);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isResting, restSeconds]);

  useEffect(() => {
    if (!isExerciseTimerRunning) return;

    if (exerciseSeconds <= 0) {
      setIsExerciseTimerRunning(false);
      return;
    }

    if (
      exerciseSeconds <= 5 &&
      exerciseSeconds > 0 &&
      exerciseCountdownSpokenRef.current !== exerciseSeconds
    ) {
      exerciseCountdownSpokenRef.current = exerciseSeconds;
      playAudioCountdown(exerciseSeconds);
    }

    const timer = window.setTimeout(() => {
      setExerciseSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isExerciseTimerRunning, exerciseSeconds]);

  useEffect(() => {
    setShowExerciseDetails(false);
    setIsExerciseTimerRunning(false);
    setExerciseSeconds(0);
    setIsPreStartRunning(false);
    setPreStartSeconds(0);
    preStartSpokenRef.current = null;
    exerciseCountdownSpokenRef.current = null;
  }, [activeStepIndex, activeSetNumber]);

  useEffect(() => {
    if (
      previewMode ||
      isRepeatMode ||
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
    previewMode,
    isRepeatMode,
    currentUserId,
    workoutId,
    workoutNotes,
    loggedExercises,
    completedSetCounts,
    activeStepIndex,
    activeSetNumber,
    showSectionIntro,
    showFinalReview,
    painReported,
    painLocation,
    painLevel,
    painExercise,
    painNotes,
    draftLoaded,
    isSubmitting,
  ]);

  const groupedExercises = useMemo(() => {
    const knownGroups = SECTION_ORDER.map((section) => {
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
    });

    const customSections = Array.from(
      new Set(
        loggedExercises
          .map((exercise) => exercise.section || "Other")
          .filter((section) => !SECTION_ORDER.includes(section))
      )
    ).map((section) => {
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
    });

    return [...knownGroups, ...customSections].filter(
      (group) => group.exercises.length > 0
    );
  }, [loggedExercises]);

  const guidedSteps = useMemo(() => {
    const steps: GuidedStep[] = [];

    groupedExercises.forEach((group) => {
      group.exercises.forEach((item) => {
        steps.push(item);
      });
    });

    return steps;
  }, [groupedExercises]);

  const activeStep = guidedSteps[activeStepIndex];
  const activeExercise = activeStep?.exercise;
  const activeOriginalIndex = activeStep?.originalIndex ?? 0;

  useEffect(() => {
    if (!isPreStartRunning) return;

    if (preStartSeconds <= 0) {
      setIsPreStartRunning(false);
      preStartSpokenRef.current = null;
      speakAudio("Start");

      if (activeExercise) {
        const seconds = getTimedExerciseSeconds(activeExercise);

        if (seconds > 0) {
          exerciseCountdownSpokenRef.current = null;
          setExerciseSeconds(seconds);
          setIsExerciseTimerRunning(true);
        }
      }

      return;
    }

    if (preStartSpokenRef.current !== preStartSeconds) {
      preStartSpokenRef.current = preStartSeconds;
      speakAudio(String(preStartSeconds));
    }

    const timer = window.setTimeout(() => {
      setPreStartSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isPreStartRunning, preStartSeconds, activeExercise, audioCountdownEnabled]);

  const currentTotalSets = activeExercise
    ? parseSets(activeExercise.plannedSets)
    : 1;

  const currentCompletedSets = activeExercise
    ? completedSetCounts[activeExercise.exerciseId] || 0
    : 0;

  const currentSectionPosition = useMemo(() => {
    if (!activeExercise) return 1;

    const sectionIndex = groupedExercises.findIndex(
      (group) => group.section === activeExercise.section
    );

    return sectionIndex >= 0 ? sectionIndex + 1 : 1;
  }, [activeExercise, groupedExercises]);

  const currentExerciseInSectionPosition = useMemo(() => {
    if (!activeExercise) return 1;

    const currentGroup = groupedExercises.find(
      (group) => group.section === activeExercise.section
    );

    if (!currentGroup) return 1;

    const exerciseIndex = currentGroup.exercises.findIndex(
      (item) => item.exercise.exerciseId === activeExercise.exerciseId
    );

    return exerciseIndex >= 0 ? exerciseIndex + 1 : 1;
  }, [activeExercise, groupedExercises]);

  const totalExercisesInCurrentSection = useMemo(() => {
    if (!activeExercise) return 1;

    const currentGroup = groupedExercises.find(
      (group) => group.section === activeExercise.section
    );

    return currentGroup?.exercises.length || 1;
  }, [activeExercise, groupedExercises]);

  const completedCount = loggedExercises.filter(
    (exercise) => exercise.completed
  ).length;

  const completionPercent =
    loggedExercises.length > 0
      ? Math.round((completedCount / loggedExercises.length) * 100)
      : 0;

  const setProgressPercent =
    currentTotalSets > 0
      ? Math.round((currentCompletedSets / currentTotalSets) * 100)
      : 0;

  const lastSavedLabel = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  function speakAudio(text: string) {
    if (!audioCountdownEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.08;
      utterance.pitch = 1;
      utterance.volume = 1;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Audio cue failed:", error);
    }
  }

  function playAudioCountdown(seconds: number) {
    if (seconds < 1 || seconds > 5) return;

    speakAudio(String(seconds));
  }

  function playCompletedSound() {
    if (!audioCountdownEnabled || typeof window === "undefined") return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const now = audioContext.currentTime;

      [660, 880].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.0001, now + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.25, now + index * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.16);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(now + index * 0.12);
        oscillator.stop(now + index * 0.12 + 0.18);
      });
    } catch (error) {
      console.error("Completion sound failed:", error);
    }
  }

  async function loadWorkout() {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setDraftLoaded(false);
    setDraftSavedAt("");

    setLoggedExercises([]);
    setCompletedSetCounts({});
    setWorkoutNotes("");
    setPainReported(false);
    setPainLocation("");
    setPainLevel("");
    setPainExercise("");
    setPainNotes("");
    setActiveStepIndex(0);
    setActiveSetNumber(1);
    setIsResting(false);
    setRestSeconds(60);
    setIsExerciseTimerRunning(false);
    setExerciseSeconds(0);
    setShowSectionIntro(true);
    setShowFinalReview(false);
    setShowExerciseDetails(false);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be logged in to view this workout.");
      setIsLoading(false);
      return;
    }

    const effectiveClientUserId = previewClientUserId || user.id;
    setCurrentUserId(effectiveClientUserId);

    const { count: unreadCount, error: unreadError } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_user_id", effectiveClientUserId)
      .eq("receiver_user_id", effectiveClientUserId)
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
        section: normalizeSection(exercise.section),
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

    if (previewMode || isRepeatMode) {
      setLoggedExercises(freshLoggedExercises);
      setCompletedSetCounts({});
      setDraftLoaded(true);
      setIsLoading(false);
      return;
    }

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
      setCompletedSetCounts(draft.draft_data?.completedSetCounts || {});
      setActiveStepIndex(draft.draft_data?.activeStepIndex || 0);
      setActiveSetNumber(draft.draft_data?.activeSetNumber || 1);
      setShowSectionIntro(draft.draft_data?.showSectionIntro ?? true);
      setShowFinalReview(draft.draft_data?.showFinalReview || false);

      setWorkoutNotes(draft.workout_notes || "");

      setPainReported(draft.draft_data?.painReported || false);
      setPainLocation(draft.draft_data?.painLocation || "");
      setPainLevel(draft.draft_data?.painLevel || "");
      setPainExercise(draft.draft_data?.painExercise || "");
      setPainNotes(draft.draft_data?.painNotes || "");

      setDraftSavedAt(draft.updated_at || "");
    } else {
      setLoggedExercises(freshLoggedExercises);
    }

    setDraftLoaded(true);
    setIsLoading(false);
  }

  async function saveDraftToSupabase() {
    if (
      previewMode ||
      isRepeatMode ||
      !currentUserId ||
      !workoutId ||
      loggedExercises.length === 0
    ) {
      return;
    }

    setIsSavingDraft(true);

    const now = new Date().toISOString();

    const draftData: WorkoutDraftData = {
      loggedExercises,
      completedSetCounts,
      activeStepIndex,
      activeSetNumber,
      showSectionIntro,
      showFinalReview,
      painReported,
      painLocation,
      painLevel,
      painExercise,
      painNotes,
    };

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
          draft_data: draftData,
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
          draft_data: draftData,
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
    if (previewMode || isRepeatMode || !currentUserId || !workoutId) return;

    await supabase
      .from("workout_drafts")
      .delete()
      .eq("client_user_id", currentUserId)
      .eq("workout_id", workoutId);

    setDraftSavedAt("");
  }

  async function resetWorkoutProgress() {
    const confirmed = window.confirm(
      "This will clear the progress currently shown on this workout. Are you sure?"
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

    setCompletedSetCounts({});
    setActiveStepIndex(0);
    setActiveSetNumber(1);
    setIsResting(false);
    setRestSeconds(60);
    setIsExerciseTimerRunning(false);
    setExerciseSeconds(0);
    setShowSectionIntro(true);
    setShowFinalReview(false);
    setShowExerciseDetails(false);

    setWorkoutNotes("");
    setPainReported(false);
    setPainLocation("");
    setPainLevel("");
    setPainExercise("");
    setPainNotes("");

    if (!previewMode && !isRepeatMode) {
      await clearSavedDraft();
    }

    setSuccessMessage("");
    setErrorMessage(
      previewMode ? "Preview progress was cleared." : "Progress was cleared."
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

  function markExerciseComplete(exerciseIndex: number) {
    setLoggedExercises((currentExercises) =>
      currentExercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;

        return {
          ...exercise,
          completed: true,
        };
      })
    );
  }

  function markExerciseIncomplete(exerciseIndex: number) {
    setLoggedExercises((currentExercises) =>
      currentExercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;

        return {
          ...exercise,
          completed: false,
        };
      })
    );
  }

  function handlePainReportedChange(value: boolean) {
    setPainReported(value);

    if (!value) {
      setPainLocation("");
      setPainLevel("");
      setPainExercise("");
      setPainNotes("");
    }
  }

  function startExerciseTimer() {
    if (!activeExercise) return;

    const seconds = getTimedExerciseSeconds(activeExercise);
    if (seconds <= 0) return;

    setIsExerciseTimerRunning(false);
    setExerciseSeconds(seconds);
    preStartSpokenRef.current = null;
    exerciseCountdownSpokenRef.current = null;
    setPreStartSeconds(3);
    setIsPreStartRunning(true);
  }

  function pauseExerciseTimer() {
    setIsPreStartRunning(false);
    setPreStartSeconds(0);
    preStartSpokenRef.current = null;
    setIsExerciseTimerRunning(false);
  }

  function resetExerciseTimer() {
    if (!activeExercise) return;

    preStartSpokenRef.current = null;
    exerciseCountdownSpokenRef.current = null;
    setIsPreStartRunning(false);
    setPreStartSeconds(0);
    setIsExerciseTimerRunning(false);
    setExerciseSeconds(getTimedExerciseSeconds(activeExercise));
  }

  function adjustRestSeconds(amount: number) {
    setRestSeconds((currentSeconds) => Math.max(0, currentSeconds + amount));
  }

  function skipRest() {
    finishRest();
  }

  function completeCurrentSet() {
    if (!activeExercise) return;

    playCompletedSound();
    setIsPreStartRunning(false);
    setPreStartSeconds(0);
    preStartSpokenRef.current = null;
    setIsExerciseTimerRunning(false);
    setExerciseSeconds(0);

    const nextCompletedSetCount = Math.max(
      currentCompletedSets,
      activeSetNumber
    );

    setCompletedSetCounts((currentCounts) => ({
      ...currentCounts,
      [activeExercise.exerciseId]: nextCompletedSetCount,
    }));

    const isLastSet = activeSetNumber >= currentTotalSets;

    if (isLastSet) {
      markExerciseComplete(activeOriginalIndex);
      moveToNextExercise();
      return;
    }

    const nextRestSeconds = parseRestSeconds(activeExercise.plannedRest);
    restCountdownSpokenRef.current = null;
    setRestSeconds(nextRestSeconds);
    setIsResting(true);
  }

  function finishRest() {
    restCountdownSpokenRef.current = null;
    setIsResting(false);
    setRestSeconds(0);
    setActiveSetNumber((currentSet) => currentSet + 1);
  }

  function moveToNextExercise() {
    restCountdownSpokenRef.current = null;
    exerciseCountdownSpokenRef.current = null;
    preStartSpokenRef.current = null;
    setIsPreStartRunning(false);
    setPreStartSeconds(0);
    setIsResting(false);
    setRestSeconds(0);
    setIsExerciseTimerRunning(false);
    setExerciseSeconds(0);

    const hasNextExercise = activeStepIndex < guidedSteps.length - 1;

    if (hasNextExercise) {
      const nextStep = guidedSteps[activeStepIndex + 1];
      const currentSection = activeExercise?.section;
      const nextSection = nextStep?.exercise.section;

      setActiveStepIndex((currentIndex) => currentIndex + 1);
      setActiveSetNumber(1);
      setShowExerciseDetails(false);

      if (currentSection && nextSection && currentSection !== nextSection) {
        setShowSectionIntro(true);
      }

      return;
    }

    setShowFinalReview(true);
  }

  function skipCurrentExercise() {
    if (!activeExercise) return;

    const confirmed = window.confirm(
      "Skip this exercise? It will stay marked as incomplete."
    );

    if (!confirmed) return;

    setIsExerciseTimerRunning(false);
    setExerciseSeconds(0);
    markExerciseIncomplete(activeOriginalIndex);
    moveToNextExercise();
  }

  function goBackStep() {
    if (showFinalReview) {
      setShowFinalReview(false);
      return;
    }

    if (isResting) {
      setIsResting(false);
      return;
    }

    if (showSectionIntro) {
      if (activeStepIndex > 0) {
        const previousStepIndex = activeStepIndex - 1;
        const previousStep = guidedSteps[previousStepIndex];

        if (previousStep) {
          const previousExerciseSets = parseSets(
            previousStep.exercise.plannedSets
          );

          setActiveStepIndex(previousStepIndex);
          setActiveSetNumber(previousExerciseSets);
          setShowSectionIntro(false);
        }
      }

      return;
    }

    if (activeSetNumber > 1) {
      setActiveSetNumber((currentSet) => currentSet - 1);
      return;
    }

    if (activeStepIndex > 0) {
      const previousStepIndex = activeStepIndex - 1;
      const previousStep = guidedSteps[previousStepIndex];

      if (previousStep) {
        const previousExerciseSets = parseSets(previousStep.exercise.plannedSets);
        setActiveStepIndex(previousStepIndex);
        setActiveSetNumber(previousExerciseSets);
      }
    }
  }

  async function submitWorkout() {
    if (previewMode) {
      setErrorMessage("Preview mode does not submit or save workout data.");
      return;
    }

    if (!workout) {
      setErrorMessage("No workout found.");
      return;
    }

    if (isSubmitting) return;

    if (loggedExercises.length === 0) {
      setErrorMessage("This workout has no exercises to submit.");
      return;
    }

    if (painReported && painLevel) {
      const numericPainLevel = Number(painLevel);

      if (
        Number.isNaN(numericPainLevel) ||
        numericPainLevel < 1 ||
        numericPainLevel > 10
      ) {
        setErrorMessage("Pain level must be between 1 and 10.");
        return;
      }
    }

    if (painReported && !painLevel) {
      setErrorMessage("Please select a pain level before submitting.");
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

    if (!isRepeatMode) {
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
    }

    const cleanPainLocation = painReported ? painLocation.trim() : "";
    const cleanPainExercise = painReported ? painExercise.trim() : "";
    const cleanPainNotes = painReported ? painNotes.trim() : "";
    const cleanPainLevel = painReported && painLevel ? Number(painLevel) : null;

    const { data: submission, error: submissionError } = await supabase
      .from("workout_submissions")
      .insert({
        client_user_id: user.id,
        workout_id: workout.id,
        workout_title: isRepeatMode
          ? `Repeated - ${workout.title}`
          : workout.title,
        notes: workoutNotes.trim(),
        pain_reported: painReported,
        pain_location: cleanPainLocation || null,
        pain_level: cleanPainLevel,
        pain_exercise: cleanPainExercise || null,
        pain_notes: cleanPainNotes || null,
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

    if (!isRepeatMode) {
      await clearSavedDraft();
    }

    setSuccessMessage(
      isRepeatMode
        ? "Repeated workout submitted successfully!"
        : "Workout submitted successfully!"
    );

    setTimeout(() => {
      navigate(`/workout-history/${submission.id}`);
    }, 700);
  }

  if (isLoading) {
    return (
      <WorkoutFrame unreadMessages={unreadMessages} embedded={!!previewBasePath}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Loading workout...
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Getting your guided workout ready.
          </p>
        </section>
      </WorkoutFrame>
    );
  }

  if (!workout || !workoutId) {
    return (
      <WorkoutFrame unreadMessages={unreadMessages} embedded={!!previewBasePath}>
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
            to={previewExitPath}
            className="mt-5 inline-block rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
          >
            Back to My Plan
          </Link>
        </section>
      </WorkoutFrame>
    );
  }

  if (isResting && activeExercise) {
    return (
      <WorkoutFrame unreadMessages={unreadMessages} embedded={!!previewBasePath}>
        {previewMode && (
          <PreviewNotice
            exitPath={previewExitPath}
            trainerMode={trainerPreviewMode}
          />
        )}
        <section className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-slate-950 shadow-sm sm:rounded-[2rem]">
          <div className="bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.55),_transparent_35%),linear-gradient(135deg,_#020617,_#0f172a,_#1d4ed8)] px-5 py-8 text-center text-white sm:px-8 sm:py-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              Rest Timer
            </p>

            <h1 className="mt-5 text-7xl font-black sm:text-8xl">
              {formatSeconds(restSeconds)}
            </h1>

            <p className="mt-5 text-sm font-semibold leading-6 text-slate-300 sm:text-base">
              Next up: Set {activeSetNumber + 1} of {currentTotalSets}
            </p>

            <button
              type="button"
              onClick={() => setAudioCountdownEnabled((current) => !current)}
              className="mt-4 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/20"
            >
              Audio Countdown: {audioCountdownEnabled ? "On" : "Off"}
            </button>

            <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/10 p-5 text-left shadow-2xl backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-200">
                Current Movement
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {activeExercise.exerciseName || "Unnamed Exercise"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {activeExercise.plannedSets || "N/A"} sets x{" "}
                {activeExercise.plannedReps || "N/A"} reps • Rest:{" "}
                {activeExercise.plannedRest || "60 sec"}
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={goBackStep}
                className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-sm font-black text-white hover:bg-white/20"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => adjustRestSeconds(-10)}
                className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-sm font-black text-white hover:bg-white/20"
              >
                -10 sec
              </button>

              <button
                type="button"
                onClick={() => adjustRestSeconds(10)}
                className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-sm font-black text-white hover:bg-white/20"
              >
                +10 sec
              </button>

              <button
                type="button"
                onClick={skipRest}
                className="rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white hover:bg-blue-700"
              >
                Skip Rest
              </button>
            </div>
          </div>
        </section>
      </WorkoutFrame>
    );
  }

  if (showFinalReview) {
    return (
      <WorkoutFrame unreadMessages={unreadMessages} embedded={!!previewBasePath}>
        {previewMode && (
          <PreviewNotice
            exitPath={previewExitPath}
            trainerMode={trainerPreviewMode}
          />
        )}
        <section className="mb-4 overflow-hidden rounded-[1.5rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-600 px-4 py-5 text-white sm:px-6 sm:py-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100">
                  {previewMode ? "Preview Complete" : "Final Review"}
                </p>

                <h1 className="mt-2 line-clamp-2 break-words text-2xl font-black leading-tight sm:text-4xl">
                  {workout.title}
                </h1>

                <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50">
                  {previewMode
                    ? "You reached the end of this workout preview. Nothing has been recorded."
                    : "Add notes, complete the pain check, then submit."}
                </p>
              </div>

              <button
                type="button"
                onClick={goBackStep}
                className="shrink-0 rounded-2xl bg-white/15 px-3 py-2 text-xs font-black text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
              >
                Back
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="rounded-[1.25rem] border border-sky-100 bg-sky-50 p-4 sm:rounded-3xl sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Progress
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                    {completedCount} / {loggedExercises.length}
                  </h2>
                </div>

                <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-blue-700 ring-1 ring-sky-100">
                  {completionPercent}%
                </div>
              </div>

              <div className="mt-4 h-3 rounded-full bg-white">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
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

        {!previewMode && (
          <section className="mb-4 rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-6">
            <label className="mb-2 block text-sm font-black text-slate-700">
              Overall Workout Notes
            </label>

            <textarea
              value={workoutNotes}
              onChange={(event) => setWorkoutNotes(event.target.value)}
              disabled={isSubmitting}
              placeholder="Optional notes about the whole workout"
              rows={4}
              className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </section>
        )}

        <section className="mb-4 rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-6">
          <h2 className="text-xl font-black text-slate-900">
            Completed Exercise Summary
          </h2>

          <div className="mt-5 space-y-3">
            {loggedExercises.map((exercise) => {
              const setsCompleted = completedSetCounts[exercise.exerciseId] || 0;
              const totalSets = parseSets(exercise.plannedSets);

              return (
                <div
                  key={exercise.exerciseId}
                  className={`rounded-2xl border p-4 ${
                    exercise.completed
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-black text-slate-900">
                        {exercise.exerciseName || "Unnamed Exercise"}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {exercise.section} • {setsCompleted} of {totalSets} sets
                        completed
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                        exercise.completed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {exercise.completed ? "Completed" : "Incomplete"}
                    </span>
                  </div>

                  {exercise.difficulty && (
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      Difficulty: {exercise.difficulty}
                    </p>
                  )}

                  {exercise.notes && (
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Notes: {exercise.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {!previewMode && (
          <section className="rounded-[1.5rem] border border-red-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              Pain & Discomfort Check
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
              Did you feel any pain today?
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              This helps your trainer adjust your plan and keep your training
              safe.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handlePainReportedChange(false)}
              disabled={isSubmitting}
              className={`rounded-2xl border px-4 py-4 text-left text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                !painReported
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100"
                  : "border-sky-100 bg-sky-50 text-slate-600 hover:bg-white"
              }`}
            >
              No pain or discomfort
            </button>

            <button
              type="button"
              onClick={() => handlePainReportedChange(true)}
              disabled={isSubmitting}
              className={`rounded-2xl border px-4 py-4 text-left text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                painReported
                  ? "border-red-200 bg-red-50 text-red-700 ring-2 ring-red-100"
                  : "border-sky-100 bg-sky-50 text-slate-600 hover:bg-white"
              }`}
            >
              Yes, I felt pain/discomfort
            </button>
          </div>

          {painReported && (
            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Pain Location
                  </label>

                  <input
                    value={painLocation}
                    onChange={(event) => setPainLocation(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Hip, shoulder, knee, back..."
                    className="w-full rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Pain Level
                  </label>

                  <select
                    value={painLevel}
                    onChange={(event) => setPainLevel(event.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select 1–10</option>
                    <option value="1">1 - Very mild</option>
                    <option value="2">2</option>
                    <option value="3">3 - Mild</option>
                    <option value="4">4</option>
                    <option value="5">5 - Moderate</option>
                    <option value="6">6</option>
                    <option value="7">7 - High</option>
                    <option value="8">8</option>
                    <option value="9">9 - Very high</option>
                    <option value="10">10 - Severe</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    Exercise Related to Pain
                  </label>

                  <input
                    value={painExercise}
                    onChange={(event) => setPainExercise(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Box Step-Up, Chest Press..."
                    className="w-full rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Pain Notes
                </label>

                <textarea
                  value={painNotes}
                  onChange={(event) => setPainNotes(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Describe what happened, when you felt it, and anything your trainer should know."
                  rows={4}
                  className="w-full rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
          )}
          </section>
        )}

        {previewMode ? (
          <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2">
            <Link
              to={previewExitPath}
              className="rounded-2xl border border-sky-100 bg-white px-5 py-4 text-center text-sm font-black text-slate-700 hover:bg-sky-50"
            >
              Back to My Plan
            </Link>

            {trainerPreviewMode ? (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-2xl bg-slate-200 px-5 py-4 text-center text-sm font-black text-slate-500"
              >
                Start Workout — Client Only
              </button>
            ) : (
              <Link
                to={`/start-workout?workoutId=${workout.id}`}
                className="rounded-2xl bg-blue-600 px-5 py-4 text-center text-sm font-black text-white shadow-sm hover:bg-blue-700"
              >
                Start This Workout →
              </Link>
            )}
          </div>
        ) : (
        <button
          type="button"
          onClick={submitWorkout}
          disabled={isSubmitting || loggedExercises.length === 0}
          className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-8"
        >
          {isSubmitting
            ? "Submitting workout..."
            : isRepeatMode
            ? "Submit Repeated Workout"
            : "Submit Workout"}
        </button>
        )}
      </WorkoutFrame>
    );
  }

  if (showSectionIntro && activeExercise) {
    const currentGroup = groupedExercises.find(
      (group) => group.section === activeExercise.section
    );

    const sectionExercises = currentGroup?.exercises || [];

    return (
      <WorkoutFrame unreadMessages={unreadMessages} embedded={!!previewBasePath}>
        {previewMode && (
          <PreviewNotice
            exitPath={previewExitPath}
            trainerMode={trainerPreviewMode}
          />
        )}
        <section className="overflow-hidden rounded-[1.5rem] border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-600 px-5 py-7 text-white sm:px-8 sm:py-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">
              Up Next
            </p>

            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
              {activeExercise.section}
            </h1>

            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-blue-100 sm:text-base">
              Preview the section, then move through each movement set by set.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-black text-white ring-1 ring-white/20">
                Section {currentSectionPosition} of {groupedExercises.length}
              </span>

              <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-black text-white ring-1 ring-white/20">
                {sectionExercises.length} movements
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
                  Section Preview
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  What’s inside
                </h2>
              </div>

              <div className="rounded-full bg-sky-50 px-4 py-2 text-sm font-black text-blue-700 ring-1 ring-sky-100">
                {sectionExercises.length} total
              </div>
            </div>

            <div className="space-y-3">
              {sectionExercises.map(({ exercise }, index) => (
                <div
                  key={exercise.exerciseId}
                  className="flex items-center gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-blue-700 ring-1 ring-sky-100">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-base font-black text-slate-900">
                      {exercise.exerciseName || "Unnamed Exercise"}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {exercise.plannedSets || "N/A"} sets x{" "}
                      {exercise.plannedReps || "N/A"} reps
                      {exercise.plannedRest
                        ? ` • Rest: ${exercise.plannedRest}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={goBackStep}
                disabled={activeStepIndex === 0}
                className="w-full rounded-2xl border border-sky-100 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-1/3"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => setShowSectionIntro(false)}
                className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 sm:w-2/3"
              >
                Start {activeExercise.section}
              </button>
            </div>
          </div>
        </section>
      </WorkoutFrame>
    );
  }

  return (
    <WorkoutFrame unreadMessages={unreadMessages} embedded={!!previewBasePath}>
      {previewMode && (
          <PreviewNotice
            exitPath={previewExitPath}
            trainerMode={trainerPreviewMode}
          />
        )}
      <div className="pb-32 md:pb-0">
        {successMessage && (
          <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center text-sm font-black text-emerald-700 shadow-sm">
            {successMessage} Opening your completed workout...
          </div>
        )}

        {errorMessage && (
          <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-center text-sm font-black text-red-700 shadow-sm">
            {errorMessage}
          </div>
        )}

        {guidedSteps.length === 0 || !activeExercise ? (
          <section className="rounded-[1.5rem] border border-red-100 bg-red-50 p-5 text-center shadow-sm sm:rounded-3xl">
            <h2 className="text-lg font-black text-red-700">
              No exercises are available
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-red-600">
              This workout exists, but no exercise rows were loaded. Go back to
              the trainer side and make sure this program has exercises saved.
            </p>
          </section>
        ) : (
          <>
            <section className="mb-3 rounded-[1.35rem] border border-blue-100 bg-blue-600 p-4 text-white shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">
                    {activeExercise.section}
                  </p>

                  <h2 className="mt-1 break-words text-lg font-black leading-tight">
                    Exercise {currentExerciseInSectionPosition} of{" "}
                    {totalExercisesInCurrentSection}
                  </h2>

                  <p className="mt-1 text-xs font-bold text-blue-100">
                    {previewMode
                      ? "Preview mode • nothing saved"
                      : isRepeatMode
                      ? "Repeat workout"
                      : isSavingDraft
                      ? "Saving..."
                      : lastSavedLabel
                      ? `Saved ${lastSavedLabel}`
                      : "Guided workout"}
                  </p>
                </div>

                <div className="shrink-0 rounded-2xl bg-white/20 px-4 py-2 text-sm font-black ring-1 ring-white/20">
                  {activeStepIndex + 1}/{guidedSteps.length}
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full bg-white/20">
                <div
                  className="h-2 rounded-full bg-white transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm">
              <div className="bg-gradient-to-br from-white via-sky-50 to-blue-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
                      Current Movement
                    </p>

                    <h1 className="mt-2 break-words text-4xl font-black leading-tight text-slate-900">
                      {activeExercise.exerciseName || "Unnamed Exercise"}
                    </h1>

                    <p className="mt-3 text-sm font-black text-slate-500">
                      Set {activeSetNumber} of {currentTotalSets}
                    </p>
                  </div>

                  <Link
                    to={previewExitPath}
                    className="shrink-0 rounded-2xl border border-sky-100 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-sky-50"
                  >
                    {previewMode ? "Exit Preview" : "Exit"}
                  </Link>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Reps/Time
                    </p>

                    <p className="mt-1 break-words text-lg font-black leading-tight text-slate-900">
                      {activeExercise.plannedReps || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Weight
                    </p>

                    <p className="mt-1 break-words text-lg font-black leading-tight text-slate-900">
                      {activeExercise.plannedWeight || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Rest
                    </p>

                    <p className="mt-1 break-words text-lg font-black leading-tight text-slate-900">
                      {activeExercise.plannedRest || "60 sec"}
                    </p>
                  </div>
                </div>

                {isTimedExercise(activeExercise) && (
                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-blue-600">
                          Timed Exercise
                        </p>

                        <p className="mt-1 text-sm font-bold text-slate-600">
                          Use this countdown for set {activeSetNumber}.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            setAudioCountdownEnabled((current) => !current)
                          }
                          className="mt-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-[11px] font-black text-blue-700 hover:bg-blue-100"
                        >
                          Audio: {audioCountdownEnabled ? "On" : "Off"}
                        </button>
                      </div>

                      <p className="text-4xl font-black text-blue-700">
                        {formatSeconds(
                          exerciseSeconds || getTimedExerciseSeconds(activeExercise)
                        )}
                      </p>
                    </div>

                    {isPreStartRunning && (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600">
                          Starting In
                        </p>

                        <p className="mt-1 text-4xl font-black text-blue-700">
                          {preStartSeconds > 0 ? preStartSeconds : "Start"}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {!isExerciseTimerRunning ? (
                        <button
                          type="button"
                          onClick={startExerciseTimer}
                          disabled={isPreStartRunning}
                          className="rounded-2xl bg-blue-600 px-3 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPreStartRunning ? "Starting..." : "Start"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={pauseExerciseTimer}
                          className="rounded-2xl bg-slate-900 px-3 py-3 text-sm font-black text-white hover:bg-slate-950"
                        >
                          Pause
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={resetExerciseTimer}
                        className="rounded-2xl border border-blue-100 bg-white px-3 py-3 text-sm font-black text-blue-700 hover:bg-blue-100"
                      >
                        Reset
                      </button>

                      <button
                        type="button"
                        onClick={completeCurrentSet}
                        disabled={isSubmitting}
                        className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-700">
                      Set Progress
                    </p>

                    <p className="text-sm font-black text-blue-700">
                      {currentCompletedSets} / {currentTotalSets}
                    </p>
                  </div>

                  <div className="mt-3 h-3 rounded-full bg-white">
                    <div
                      className="h-3 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${setProgressPercent}%` }}
                    />
                  </div>
                </div>

                {activeExercise.videoLink && (
                  <a
                    href={activeExercise.videoLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 block w-full rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-sm font-black text-blue-700 hover:bg-blue-100"
                  >
                    Watch Exercise Video
                  </a>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setShowExerciseDetails((currentValue) => !currentValue)
                  }
                  className="mt-4 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-sky-50"
                >
                  {showExerciseDetails
                    ? "Hide Difficulty / Notes"
                    : "Add Difficulty / Notes"}
                </button>

                {showExerciseDetails && (
                  <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-black text-slate-700">
                          Difficulty
                        </label>

                        <select
                          value={activeExercise.difficulty}
                          onChange={(event) =>
                            updateDifficulty(
                              activeOriginalIndex,
                              event.target.value
                            )
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
                          Exercise Notes
                        </label>

                        <input
                          value={activeExercise.notes}
                          onChange={(event) =>
                            updateNotes(activeOriginalIndex, event.target.value)
                          }
                          disabled={isSubmitting}
                          placeholder="Optional note for your trainer"
                          className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                  <span>
                    {completedCount} of {loggedExercises.length} completed
                  </span>

                  <button
                    type="button"
                    onClick={resetWorkoutProgress}
                    disabled={isSubmitting}
                    className="font-black text-red-600 disabled:opacity-60"
                  >
                    Clear Progress
                  </button>
                </div>
              </div>
            </section>

            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-sky-100 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
              <div className="mx-auto grid max-w-3xl grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={goBackStep}
                  disabled={activeStepIndex === 0 && activeSetNumber === 1}
                  className="rounded-2xl border border-sky-100 bg-white px-3 py-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={skipCurrentExercise}
                  disabled={isSubmitting}
                  className="rounded-2xl border border-orange-100 bg-orange-50 px-3 py-4 text-sm font-black text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Skip
                </button>

                <button
                  type="button"
                  onClick={completeCurrentSet}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-blue-600 px-3 py-4 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Complete
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </WorkoutFrame>
  );
}

function PreviewNotice({
  exitPath,
  trainerMode = false,
}: {
  exitPath: string;
  trainerMode?: boolean;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
          {trainerMode ? "Trainer • Client Workout Preview" : "Workout Preview"}
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
          {trainerMode
            ? "You are walking through the same guided preview available to this client. Nothing here is saved or counted as completion."
            : "Explore the full workout. Nothing you do here will be saved or count as completion."}
        </p>
      </div>

      <Link
        to={exitPath}
        className="shrink-0 rounded-xl bg-white px-4 py-2 text-center text-xs font-black text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
      >
        Exit Preview
      </Link>
    </div>
  );
}

function WorkoutFrame({
  unreadMessages,
  embedded,
  children,
}: {
  unreadMessages: number;
  embedded: boolean;
  children: ReactNode;
}) {
  if (embedded) {
    return <>{children}</>;
  }

  return (
    <ClientLayout unreadMessages={unreadMessages}>{children}</ClientLayout>
  );
}
