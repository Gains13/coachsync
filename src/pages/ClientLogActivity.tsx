import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type PersonalExercise = {
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  distance: string;
  duration: string;
  notes: string;
};

const emptyExercise: PersonalExercise = {
  exerciseName: "",
  sets: "",
  reps: "",
  weight: "",
  distance: "",
  duration: "",
  notes: "",
};

export default function ClientLogActivity() {
  const [clientUserId, setClientUserId] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [activityType, setActivityType] = useState("Gym Workout");
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [location, setLocation] = useState("");
  const [intensity, setIntensity] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<PersonalExercise[]>([
    { ...emptyExercise },
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadClient();
  }, []);

  async function loadClient() {
    setIsLoading(true);
    setStatusMessage("");
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be logged in to log an activity.");
      setIsLoading(false);
      return;
    }

    setClientUserId(user.id);

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

    setIsLoading(false);
  }

  function updateExercise(
    exerciseIndex: number,
    field: keyof PersonalExercise,
    value: string
  ) {
    setExercises((currentExercises) =>
      currentExercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;

        return {
          ...exercise,
          [field]: value,
        };
      })
    );
  }

  function addExercise() {
    setExercises((currentExercises) => [
      ...currentExercises,
      { ...emptyExercise },
    ]);
  }

  function removeExercise(exerciseIndex: number) {
    setExercises((currentExercises) => {
      if (currentExercises.length === 1) {
        return [{ ...emptyExercise }];
      }

      return currentExercises.filter((_, index) => index !== exerciseIndex);
    });
  }

  function clearForm() {
    setActivityType("Gym Workout");
    setTitle("");
    setDurationMinutes("");
    setLocation("");
    setIntensity("");
    setNotes("");
    setExercises([{ ...emptyExercise }]);
  }

  async function saveActivity(event: React.FormEvent) {
    event.preventDefault();

    setStatusMessage("");
    setErrorMessage("");

    if (!clientUserId) {
      setErrorMessage("Client account not found. Please log in again.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Please add a title for this activity.");
      return;
    }

    if (!activityType.trim()) {
      setErrorMessage("Please choose an activity type.");
      return;
    }

    setIsSaving(true);

    const durationNumber = durationMinutes
      ? Number(durationMinutes.replace(/[^0-9]/g, ""))
      : null;

    const { data: logData, error: logError } = await supabase
      .from("personal_workout_logs")
      .insert({
        client_user_id: clientUserId,
        activity_type: activityType.trim(),
        title: title.trim(),
        duration_minutes: durationNumber,
        location: location.trim(),
        intensity: intensity.trim(),
        notes: notes.trim(),
      })
      .select("id")
      .single();

    if (logError || !logData) {
      console.error(logError);
      setErrorMessage(logError?.message || "Could not save activity.");
      setIsSaving(false);
      return;
    }

    const exerciseRows = exercises
      .filter((exercise) => {
        return (
          exercise.exerciseName.trim() ||
          exercise.sets.trim() ||
          exercise.reps.trim() ||
          exercise.weight.trim() ||
          exercise.distance.trim() ||
          exercise.duration.trim() ||
          exercise.notes.trim()
        );
      })
      .map((exercise, index) => ({
        log_id: logData.id,
        exercise_name: exercise.exerciseName.trim(),
        sets: exercise.sets.trim(),
        reps: exercise.reps.trim(),
        weight: exercise.weight.trim(),
        distance: exercise.distance.trim(),
        duration: exercise.duration.trim(),
        notes: exercise.notes.trim(),
        exercise_order: index + 1,
      }));

    if (exerciseRows.length > 0) {
      const { error: exercisesError } = await supabase
        .from("personal_workout_exercises")
        .insert(exerciseRows);

      if (exercisesError) {
        console.error(exercisesError);
        setErrorMessage(
          "Activity was saved, but the exercise details were not saved: " +
            exercisesError.message
        );
        setIsSaving(false);
        return;
      }
    }

    setStatusMessage("Activity logged successfully.");
    setIsSaving(false);
    clearForm();
  }

  if (isLoading) {
    return (
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Loading activity log...
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Getting your activity form ready.
          </p>
        </section>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-emerald-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100 sm:text-sm sm:tracking-[0.3em]">
            Personal Activity
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            Log Activity
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:mt-3 sm:text-base">
            Record a hike, bike ride, walk, gym workout, home workout, or any
            extra training you completed on your own.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard title="Type" value={activityType || "Not set"} />
          <SummaryCard title="Exercises" value={`${exercises.length}`} />
          <SummaryCard
            title="Duration"
            value={durationMinutes ? `${durationMinutes} min` : "Not set"}
          />
          <SummaryCard title="Messages" value={`${unreadMessages}`} />
        </div>
      </section>

      <form
        onSubmit={saveActivity}
        className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6"
      >
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Activity Details
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
            What did you do?
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Add the main activity first, then include exercises if it was a gym
            or home workout.
          </p>
        </div>

        {statusMessage && (
          <p className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
            {statusMessage}
          </p>
        )}

        {errorMessage && (
          <p className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Activity Type">
            <select
              value={activityType}
              onChange={(event) => setActivityType(event.target.value)}
              className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="Gym Workout">Gym Workout</option>
              <option value="At-Home Workout">At-Home Workout</option>
              <option value="Walk">Walk</option>
              <option value="Hike">Hike</option>
              <option value="Bike Ride">Bike Ride</option>
              <option value="Run">Run</option>
              <option value="Mobility Session">Mobility Session</option>
              <option value="Sport Activity">Sport Activity</option>
              <option value="Other">Other</option>
            </select>
          </FormField>

          <FormField label="Activity Title">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: 30-minute hike"
              className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </FormField>

          <FormField label="Duration Minutes">
            <input
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              placeholder="30"
              inputMode="numeric"
              className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </FormField>

          <FormField label="Location">
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Gym, home, trail, campus..."
              className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </FormField>

          <FormField label="Intensity">
            <select
              value={intensity}
              onChange={(event) => setIntensity(event.target.value)}
              className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select intensity</option>
              <option value="Easy">Easy</option>
              <option value="Moderate">Moderate</option>
              <option value="Hard">Hard</option>
              <option value="Very Hard">Very Hard</option>
            </select>
          </FormField>

          <FormField label="Overall Notes">
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="How did it feel?"
              className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </FormField>
        </div>

        <div className="mt-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Exercise Details
              </p>

              <h3 className="mt-1 text-lg font-black text-slate-900">
                Add exercises, sets, reps, weight, distance, or notes
              </h3>
            </div>

            <button
              type="button"
              onClick={addExercise}
              className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:w-auto"
            >
              Add Exercise
            </button>
          </div>

          <div className="space-y-4">
            {exercises.map((exercise, index) => (
              <div
                key={index}
                className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="font-black text-slate-900">
                    Exercise {index + 1}
                  </h4>

                  <button
                    type="button"
                    onClick={() => removeExercise(index)}
                    className="w-full rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 sm:w-auto"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Exercise Name">
                    <input
                      value={exercise.exerciseName}
                      onChange={(event) =>
                        updateExercise(
                          index,
                          "exerciseName",
                          event.target.value
                        )
                      }
                      placeholder="Bench press, hike, bike ride..."
                      className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </FormField>

                  <FormField label="Sets">
                    <input
                      value={exercise.sets}
                      onChange={(event) =>
                        updateExercise(index, "sets", event.target.value)
                      }
                      placeholder="3"
                      className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </FormField>

                  <FormField label="Reps">
                    <input
                      value={exercise.reps}
                      onChange={(event) =>
                        updateExercise(index, "reps", event.target.value)
                      }
                      placeholder="10"
                      className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </FormField>

                  <FormField label="Weight">
                    <input
                      value={exercise.weight}
                      onChange={(event) =>
                        updateExercise(index, "weight", event.target.value)
                      }
                      placeholder="95 lbs"
                      className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </FormField>

                  <FormField label="Distance">
                    <input
                      value={exercise.distance}
                      onChange={(event) =>
                        updateExercise(index, "distance", event.target.value)
                      }
                      placeholder="2 miles"
                      className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </FormField>

                  <FormField label="Duration">
                    <input
                      value={exercise.duration}
                      onChange={(event) =>
                        updateExercise(index, "duration", event.target.value)
                      }
                      placeholder="30 minutes"
                      className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </FormField>
                </div>

                <div className="mt-4">
                  <FormField label="Exercise Notes">
                    <textarea
                      value={exercise.notes}
                      onChange={(event) =>
                        updateExercise(index, "notes", event.target.value)
                      }
                      placeholder="Optional notes for your trainer..."
                      rows={3}
                      className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? "Saving Activity..." : "Save Activity"}
          </button>

          <button
            type="button"
            onClick={clearForm}
            disabled={isSaving}
            className="w-full rounded-2xl border border-sky-100 bg-white px-5 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Clear Form
          </button>
        </div>
      </form>
    </ClientLayout>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2 className="mt-2 line-clamp-2 break-words text-xl font-black leading-tight text-slate-900 sm:text-2xl">
        {value}
      </h2>
    </div>
  );
}