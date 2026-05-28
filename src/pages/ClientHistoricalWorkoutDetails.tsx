import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type HistoricalWorkoutExercise = {
  id: string;
  section: string | null;
  exercise_name: string | null;
  sets: string | null;
  reps: string | null;
  weight: string | null;
  rest: string | null;
  raw_text: string | null;
  exercise_order: number | null;
};

type HistoricalWorkout = {
  id: string;
  client_user_id: string;
  title: string;
  workout_date: string | null;
  source: string | null;
  notes: string | null;
  created_at: string | null;
  client_historical_workout_exercises: HistoricalWorkoutExercise[];
};

export default function ClientHistoricalWorkoutDetails() {
  const { historicalWorkoutId } = useParams();

  const [workout, setWorkout] = useState<HistoricalWorkout | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadHistoricalWorkout();
  }, [historicalWorkoutId]);

  async function loadHistoricalWorkout() {
    setIsLoading(true);
    setStatusMessage("");

    if (!historicalWorkoutId) {
      setStatusMessage("Workout not found.");
      setIsLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in to view this workout.");
      setIsLoading(false);
      return;
    }

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

    const { data, error } = await supabase
      .from("client_historical_workouts")
      .select(
        `
        id,
        client_user_id,
        title,
        workout_date,
        source,
        notes,
        created_at,
        client_historical_workout_exercises (
          id,
          section,
          exercise_name,
          sets,
          reps,
          weight,
          rest,
          raw_text,
          exercise_order
        )
      `
      )
      .eq("id", historicalWorkoutId)
      .eq("client_user_id", user.id)
      .single();

    if (error || !data) {
      console.error(error);
      setStatusMessage("Could not load this imported workout.");
      setIsLoading(false);
      return;
    }

    const cleanedWorkout = {
      ...(data as HistoricalWorkout),
      client_historical_workout_exercises: [
        ...((data as HistoricalWorkout).client_historical_workout_exercises ||
          []),
      ].sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0)),
    };

    setWorkout(cleanedWorkout);
    setIsLoading(false);
  }

  const groupedExercises = useMemo(() => {
    if (!workout) return [];

    const groups: Record<string, HistoricalWorkoutExercise[]> = {};

    workout.client_historical_workout_exercises.forEach((exercise) => {
      const section = exercise.section || "Workout";

      if (!groups[section]) {
        groups[section] = [];
      }

      groups[section].push(exercise);
    });

    return Object.entries(groups).map(([section, exercises]) => ({
      section,
      exercises,
    }));
  }, [workout]);

  if (isLoading) {
    return (
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Imported Workout
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Loading workout details...
          </h1>
        </section>
      </ClientLayout>
    );
  }

  if (statusMessage || !workout) {
    return (
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Imported Workout
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Workout not available
          </h1>

          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            {statusMessage || "Could not load this workout."}
          </p>

          <Link
            to="/client-past-workouts"
            className="mt-5 inline-block rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
          >
            Back to Past Workouts
          </Link>
        </section>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-amber-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100 sm:text-sm sm:tracking-[0.3em]">
            Imported Past Workout
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            {workout.title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-50 sm:mt-3 sm:text-base">
            Imported from your trainer’s notes. You can review the full workout
            or repeat it.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard title="Date" value={formatDate(workout.workout_date)} />
          <SummaryCard
            title="Exercises"
            value={`${workout.client_historical_workout_exercises.length}`}
          />
          <SummaryCard title="Sections" value={`${groupedExercises.length}`} />
          <SummaryCard title="Source" value="Trainer Notes" />
        </div>
      </section>

      <section className="mb-4 rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            to="/client-past-workouts"
            className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-3 text-center text-sm font-black text-blue-700 transition hover:bg-blue-50"
          >
            ← Back to Past Workouts
          </Link>

          <Link
            to={`/repeat-historical-workout/${workout.id}`}
            className="rounded-2xl bg-amber-500 px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-amber-600"
          >
            Repeat This Workout
          </Link>
        </div>

        {workout.notes && (
          <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Notes
            </p>

            <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">
              {workout.notes}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
            Full Workout
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
            Exercise Details
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Exercises are grouped by the sections your trainer recorded.
          </p>
        </div>

        {groupedExercises.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 p-5 text-sm font-semibold text-slate-600">
            No exercises found for this imported workout.
          </p>
        ) : (
          <div className="space-y-6">
            {groupedExercises.map((group) => (
              <div
                key={group.section}
                className="rounded-3xl border border-amber-100 bg-amber-50 p-4 sm:p-5"
              >
                <h3 className="text-lg font-black text-slate-900">
                  {group.section}
                </h3>

                <div className="mt-4 space-y-3">
                  {group.exercises.map((exercise, index) => (
                    <div
                      key={exercise.id}
                      className="rounded-2xl border border-amber-100 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                            Exercise {index + 1}
                          </p>

                          <h4 className="mt-1 text-base font-black text-slate-900 sm:text-lg">
                            {exercise.exercise_name ||
                              exercise.raw_text ||
                              "Exercise"}
                          </h4>
                        </div>

                        {exercise.raw_text && (
                          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">
                            Imported
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <MiniInfo
                          label="Weight"
                          value={exercise.weight || "Not set"}
                        />
                        <MiniInfo
                          label="Sets"
                          value={exercise.sets || "Not set"}
                        />
                        <MiniInfo
                          label="Reps"
                          value={exercise.reps || "Not set"}
                        />
                        <MiniInfo
                          label="Rest"
                          value={exercise.rest || "Not set"}
                        />
                      </div>

                      {exercise.raw_text && (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Original Note
                          </p>

                          <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">
                            {exercise.raw_text}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </ClientLayout>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Date not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date not recorded";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2 className="mt-2 line-clamp-2 break-words text-lg font-black leading-tight text-slate-900 sm:text-xl">
        {value}
      </h2>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}