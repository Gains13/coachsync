import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type CompletedSubmission = {
  id: string;
  workout_title: string;
};

type PlanExercise = {
  id: string;
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
  workout_order: number;
  client_plan_exercises: PlanExercise[];
};

type PlanWeek = {
  id: string;
  week_number: number;
  status: string;
  client_plan_workouts: PlanWorkout[];
};

export default function ClientPlan() {
  const [completedSubmissions, setCompletedSubmissions] = useState<
    CompletedSubmission[]
  >([]);
  const [assignedWeeks, setAssignedWeeks] = useState<PlanWeek[]>([]);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(true);
  const [isLoadingProgram, setIsLoadingProgram] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadPlanData();
  }, []);

  async function loadPlanData() {
    setIsLoadingCompleted(true);
    setIsLoadingProgram(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in to view your plan.");
      setIsLoadingCompleted(false);
      setIsLoadingProgram(false);
      return;
    }

    const { data: completedData, error: completedError } = await supabase
      .from("workout_submissions")
      .select("id, workout_title")
      .eq("client_user_id", user.id);

    if (completedError) {
      setStatusMessage(
        "Could not load completed workouts: " + completedError.message
      );
      setIsLoadingCompleted(false);
      setIsLoadingProgram(false);
      return;
    }

    setCompletedSubmissions(completedData || []);
    setIsLoadingCompleted(false);

    const { data: programData, error: programError } = await supabase
      .from("client_plan_weeks")
      .select(
        `
        id,
        week_number,
        status,
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
      .eq("client_user_id", user.id)
      .order("week_number", { ascending: true });

    if (programError) {
      setStatusMessage("Could not load assigned plan: " + programError.message);
      setIsLoadingProgram(false);
      return;
    }

    setAssignedWeeks((programData || []) as PlanWeek[]);
    setIsLoadingProgram(false);
  }

  const completedWorkoutTitles = useMemo(
    () => completedSubmissions.map((submission) => submission.workout_title),
    [completedSubmissions]
  );

  function getCompletedSubmissionId(workoutTitle: string) {
    return completedSubmissions.find(
      (submission) => submission.workout_title === workoutTitle
    )?.id;
  }

  const nextAssignedWorkout = useMemo(() => {
    const availableWorkouts = assignedWeeks
      .filter((week) => week.status !== "locked")
      .flatMap((week) => week.client_plan_workouts || []);

    return [...availableWorkouts]
      .sort((a, b) => a.workout_order - b.workout_order)
      .find((workout) => !completedWorkoutTitles.includes(workout.title));
  }, [assignedWeeks, completedWorkoutTitles]);

  return (
    <PageShell
      title="My Plan"
      subtitle="View your current workout, upcoming sessions, and completed workouts."
    >
      {statusMessage && (
        <p className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium text-slate-700">
          {statusMessage}
        </p>
      )}

      {isLoadingProgram || isLoadingCompleted ? (
        <p className="rounded-2xl bg-sky-50 p-5 text-slate-500">
          Loading your assigned program...
        </p>
      ) : assignedWeeks.length === 0 ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-6">
          <h3 className="text-lg font-bold text-slate-900">
            No assigned program yet
          </h3>

          <p className="mt-2 text-slate-500">
            Your trainer has not added a program for you yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {assignedWeeks.map((week) => {
            const sortedWeekWorkouts = [...(week.client_plan_workouts || [])].sort(
              (a, b) => {
                const aCompleted = completedWorkoutTitles.includes(a.title);
                const bCompleted = completedWorkoutTitles.includes(b.title);

                if (!aCompleted && bCompleted) return -1;
                if (aCompleted && !bCompleted) return 1;

                return a.workout_order - b.workout_order;
              }
            );

            return (
              <div
                key={week.id}
                className={`rounded-3xl border p-5 ${
                  week.status === "locked"
                    ? "border-slate-200 bg-slate-50 opacity-80"
                    : "border-sky-100 bg-sky-50"
                }`}
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-bold text-slate-900">
                    Week {week.week_number}
                  </h3>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      week.status === "locked"
                        ? "bg-red-50 text-red-600 ring-1 ring-red-100"
                        : week.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                    }`}
                  >
                    {week.status === "locked"
                      ? "Locked / Upcoming"
                      : week.status}
                  </span>
                </div>

                <div className="space-y-4">
                  {sortedWeekWorkouts.length === 0 ? (
                    <p className="rounded-2xl bg-white p-4 text-slate-500">
                      No workouts added for this week yet.
                    </p>
                  ) : (
                    sortedWeekWorkouts.map((workout) => {
                      const isCompleted = completedWorkoutTitles.includes(
                        workout.title
                      );

                      const completedSubmissionId = getCompletedSubmissionId(
                        workout.title
                      );

                      const isCurrentWorkout =
                        week.status !== "locked" &&
                        nextAssignedWorkout?.id === workout.id;

                      const isUpcoming = !isCompleted && !isCurrentWorkout;

                      if (isCompleted && completedSubmissionId) {
                        return (
                          <Link
                            key={workout.id}
                            to={`/workout-history/${completedSubmissionId}`}
                            className="block rounded-2xl border border-slate-200 bg-white p-5 opacity-70 shadow-sm transition hover:border-blue-200 hover:opacity-100 hover:shadow-md"
                          >
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <h4 className="font-semibold text-slate-900">
                                {workout.title}
                              </h4>

                              <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                Completed
                              </span>
                            </div>

                            <WorkoutExerciseList workout={workout} />

                            <div className="mt-4 inline-block rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                              View Completed Workout
                            </div>
                          </Link>
                        );
                      }

                      return (
                        <div
                          key={workout.id}
                          className={`rounded-2xl border p-5 shadow-sm ${
                            isCurrentWorkout
                              ? "border-blue-300 bg-white shadow-blue-100"
                              : "border-slate-200 bg-white opacity-75"
                          }`}
                        >
                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h4 className="font-semibold text-slate-900">
                              {workout.title}
                            </h4>

                            {isCurrentWorkout ? (
                              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                                Current Workout
                              </span>
                            ) : week.status === "locked" ? (
                              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-100">
                                Locked
                              </span>
                            ) : isUpcoming ? (
                              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                                Upcoming
                              </span>
                            ) : null}
                          </div>

                          <WorkoutExerciseList workout={workout} />

                          {isCurrentWorkout ? (
                            <Link
                              to={`/start-workout?workoutId=${workout.id}`}
                              className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                            >
                              Start Workout
                            </Link>
                          ) : (
                            <button
                              disabled
                              className="mt-4 cursor-not-allowed rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500"
                            >
                              {week.status === "locked"
                                ? "Locked until trainer unlocks"
                                : "Complete current workout first"}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function WorkoutExerciseList({ workout }: { workout: PlanWorkout }) {
  const exercises = [...(workout.client_plan_exercises || [])].sort(
    (a, b) => a.exercise_order - b.exercise_order
  );

  if (exercises.length === 0) {
    return (
      <p className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-500">
        No exercises added yet.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {exercises.map((exercise) => (
        <div
          key={exercise.id}
          className="rounded-2xl border border-sky-100 bg-sky-50 p-4"
        >
          <p className="font-semibold text-slate-900">
            {exercise.exercise_name}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {exercise.sets} sets x {exercise.reps} reps • Weight:{" "}
            {exercise.weight || "N/A"} • Rest: {exercise.rest || "N/A"}
          </p>

          {exercise.video_link && (
            <a
              href={exercise.video_link}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="mt-3 inline-block rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Watch Video
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              CoachSync
            </p>

            <h1 className="mt-2 text-3xl font-bold md:text-4xl">{title}</h1>

            <p className="mt-2 max-w-2xl text-slate-500">{subtitle}</p>
          </div>

          <Link
            to="/client"
            className="rounded-xl border border-sky-100 bg-white px-4 py-2 text-center text-sm font-semibold text-blue-600 shadow-sm hover:bg-sky-50"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          {children}
        </div>
      </section>
    </main>
  );
}