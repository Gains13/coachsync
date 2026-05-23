import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type ExerciseForm = {
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  videoLink: string;
};

type WorkoutForm = {
  title: string;
  exercises: ExerciseForm[];
};

export default function CreateProgram() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [weekNumber, setWeekNumber] = useState("1");
  const [weekStatus, setWeekStatus] = useState("unlocked");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [workouts, setWorkouts] = useState<WorkoutForm[]>([
    {
      title: "",
      exercises: [
        {
          exerciseName: "",
          sets: "",
          reps: "",
          weight: "",
          rest: "",
          videoLink: "",
        },
      ],
    },
  ]);

  useEffect(() => {
    async function loadClients() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, client_id")
        .eq("role", "client")
        .order("full_name", { ascending: true });

      if (error) {
        console.error(error);
        setStatusMessage("Could not load clients.");
        return;
      }

      setClients(data || []);
    }

    loadClients();
  }, []);

  function updateWorkoutTitle(workoutIndex: number, value: string) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;
        return { ...workout, title: value };
      })
    );
  }

  function addWorkout() {
    setWorkouts((currentWorkouts) => [
      ...currentWorkouts,
      {
        title: "",
        exercises: [
          {
            exerciseName: "",
            sets: "",
            reps: "",
            weight: "",
            rest: "",
            videoLink: "",
          },
        ],
      },
    ]);
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
          exercises: [
            ...workout.exercises,
            {
              exerciseName: "",
              sets: "",
              reps: "",
              weight: "",
              rest: "",
              videoLink: "",
            },
          ],
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
      setStatusMessage("Please select a client.");
      return;
    }

    if (!weekNumber) {
      setStatusMessage("Week number is required.");
      return;
    }

    const validWorkouts = workouts
      .map((workout) => ({
        ...workout,
        title: workout.title.trim(),
        exercises: workout.exercises.filter(
          (exercise) => exercise.exerciseName.trim() !== ""
        ),
      }))
      .filter((workout) => workout.title !== "" && workout.exercises.length > 0);

    if (validWorkouts.length === 0) {
      setStatusMessage("Add at least one workout title with at least one exercise.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    const { data: weekData, error: weekError } = await supabase
      .from("client_plan_weeks")
      .insert({
        client_user_id: selectedClientId,
        week_number: Number(weekNumber),
        status: weekStatus,
      })
      .select()
      .single();

    if (weekError || !weekData) {
      console.error(weekError);
      setStatusMessage(weekError?.message || "Could not create week.");
      setIsSaving(false);
      return;
    }

    for (let workoutIndex = 0; workoutIndex < validWorkouts.length; workoutIndex++) {
      const workout = validWorkouts[workoutIndex];

      const { data: workoutData, error: workoutError } = await supabase
        .from("client_plan_workouts")
        .insert({
          week_id: weekData.id,
          title: workout.title,
          workout_order: workoutIndex + 1,
        })
        .select()
        .single();

      if (workoutError || !workoutData) {
        console.error(workoutError);
        setStatusMessage(workoutError?.message || `Could not create workout ${workoutIndex + 1}.`);
        setIsSaving(false);
        return;
      }

      const exerciseRows = workout.exercises.map((exercise, exerciseIndex) => ({
        workout_id: workoutData.id,
        exercise_name: exercise.exerciseName.trim(),
        sets: exercise.sets.trim(),
        reps: exercise.reps.trim(),
        weight: exercise.weight.trim(),
        rest: exercise.rest.trim(),
        video_link: exercise.videoLink.trim(),
        exercise_order: exerciseIndex + 1,
      }));

      const { error: exerciseError } = await supabase
        .from("client_plan_exercises")
        .insert(exerciseRows);

      if (exerciseError) {
        console.error(exerciseError);
        setStatusMessage(
          `Workout ${workout.title} was created, but exercises failed: ` +
            exerciseError.message
        );
        setIsSaving(false);
        return;
      }
    }

    setStatusMessage("Program week saved successfully.");

    setWeekNumber("1");
    setWeekStatus("unlocked");
    setWorkouts([
      {
        title: "",
        exercises: [
          {
            exerciseName: "",
            sets: "",
            reps: "",
            weight: "",
            rest: "",
            videoLink: "",
          },
        ],
      },
    ]);

    setIsSaving(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Program Builder
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  Create Client Program
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Build one training week with multiple workouts and exercises.
                </p>
              </div>

              <Link
                to="/trainer"
                className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
              >
                Back to Trainer
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
            <SummaryCard title="Step 1" value="Choose Client" />
            <SummaryCard title="Step 2" value="Build Week" />
            <SummaryCard title="Step 3" value="Save Program" />
          </div>
        </div>

        <form
          onSubmit={saveProgram}
          className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Client
              </label>

              <select
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} — {client.client_id}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Week Number"
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

          <div className="mt-8">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Workouts / Sessions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add each session for this week, then add exercises inside each session.
                </p>
              </div>

              <button
                type="button"
                onClick={addWorkout}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Add Workout
              </button>
            </div>

            <div className="space-y-6">
              {workouts.map((workout, workoutIndex) => (
                <div
                  key={workoutIndex}
                  className="rounded-3xl border border-sky-100 bg-sky-50 p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      Workout {workoutIndex + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeWorkout(workoutIndex)}
                      className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                    >
                      Remove Workout
                    </button>
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
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-sky-100 hover:bg-blue-50"
                      >
                        Add Exercise
                      </button>
                    </div>

                    <div className="space-y-4">
                      {workout.exercises.map((exercise, exerciseIndex) => (
                        <div
                          key={exerciseIndex}
                          className="rounded-2xl border border-sky-100 bg-white p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <h5 className="font-semibold text-slate-900">
                              Exercise {exerciseIndex + 1}
                            </h5>

                            <button
                              type="button"
                              onClick={() => removeExercise(workoutIndex, exerciseIndex)}
                              className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                            >
                              Remove
                            </button>
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
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {statusMessage && (
            <p className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium text-slate-700">
              {statusMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving Program..." : "Save Program Week"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">{value}</h2>
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