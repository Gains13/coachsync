import { useEffect, useState } from "react";
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

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type ExerciseForm = {
  formId: string;
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
  exercises: ExerciseForm[];
};

type ExistingExercise = {
  id: string;
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
    workout_order: number;
    client_plan_exercises: ExistingExercise[];
  }[];
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankExercise(): ExerciseForm {
  return {
    formId: makeId(),
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
    exercises: [blankExercise()],
  };
}

export default function CreateProgram() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [copySourceClientId, setCopySourceClientId] = useState("");

  const [weekNumber, setWeekNumber] = useState("1");
  const [weekStatus, setWeekStatus] = useState("unlocked");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);

  const [workouts, setWorkouts] = useState<WorkoutForm[]>([blankWorkout()]);

  const [existingWorkouts, setExistingWorkouts] = useState<ExistingWorkout[]>(
    []
  );
  const [selectedWorkoutToCopy, setSelectedWorkoutToCopy] = useState("");
  const [isLoadingExistingWorkouts, setIsLoadingExistingWorkouts] =
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
    loadClients();
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
          workout_order,
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

  function handleClientChange(value: string) {
    setSelectedClientId(value);

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
              exerciseName: exercise.exercise_name || "",
              sets: exercise.sets || "",
              reps: exercise.reps || "",
              weight: exercise.weight || "",
              rest: exercise.rest || "",
              videoLink: exercise.video_link || "",
            }))
          : [blankExercise()],
    };

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

    setStatusMessage(
      `"${workoutToCopy.title}" from ${workoutToCopy.source_client_name} copied into the form. You can now edit it before saving to the target client.`
    );
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

  function addExercise(workoutIndex: number) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        return {
          ...workout,
          exercises: [...workout.exercises, blankExercise()],
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

  async function saveProgram(event: React.FormEvent) {
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
        exercises: workout.exercises
          .map((exercise) => ({
            ...exercise,
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
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const copySourceClient = clients.find(
    (client) => client.id === copySourceClientId
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
                  Build a new week for one client, copy workouts from any
                  client, add multiple workouts to the same week, and edit
                  everything before saving.
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
            <SummaryCard title="Step 2" value="Copy From Any Client" />
            <SummaryCard title="Step 3" value="Edit + Drag" />
            <SummaryCard title="Step 4" value="Save or Add to Week" />
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
            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Copy Existing Workout
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Choose any client as the source, copy one of their workouts,
                    then edit it before saving it to the target client.
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
                  No previous workouts found for this source client yet.
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

          <div className="mt-8">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Workouts / Sessions
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Set the week number above. If that week already exists, these
                  workout(s) will be added into that week instead of being
                  blocked.
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
                    placeholder="Push Day"
                  />

                  <div className="mt-5">
                    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <h4 className="font-bold text-slate-900">Exercises</h4>

                      <button
                        type="button"
                        onClick={() => addExercise(workoutIndex)}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-sky-100 transition hover:bg-blue-50"
                      >
                        Add Exercise
                      </button>
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
                        <div className="space-y-4">
                          {workout.exercises.map((exercise, exerciseIndex) => (
                            <SortableExerciseCard
                              key={exercise.formId}
                              exercise={exercise}
                              exerciseIndex={exerciseIndex}
                              workoutIndex={workoutIndex}
                              totalExercises={workout.exercises.length}
                              updateExercise={updateExercise}
                              moveExercise={moveExercise}
                              removeExercise={removeExercise}
                            />
                          ))}
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
  workoutIndex,
  totalExercises,
  updateExercise,
  moveExercise,
  removeExercise,
}: {
  exercise: ExerciseForm;
  exerciseIndex: number;
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
            aria-label={`Drag Exercise ${exerciseIndex + 1}`}
          >
            ☰ Drag
          </button>

          <h5 className="font-semibold text-slate-900">
            Exercise {exerciseIndex + 1}
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
        <Input
          label="Exercise Name"
          value={exercise.exerciseName}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "exerciseName", value)
          }
          placeholder="Bench Press"
        />

        <Input
          label="Sets"
          value={exercise.sets}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "sets", value)
          }
          placeholder="3"
        />

        <Input
          label="Reps"
          value={exercise.reps}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "reps", value)
          }
          placeholder="10"
        />

        <Input
          label="Weight"
          value={exercise.weight}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "weight", value)
          }
          placeholder="95 lbs"
        />

        <Input
          label="Rest"
          value={exercise.rest}
          onChange={(value) =>
            updateExercise(workoutIndex, exerciseIndex, "rest", value)
          }
          placeholder="60 seconds"
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