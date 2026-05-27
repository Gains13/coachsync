import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type CompletedSubmission = {
  id: string;
  workout_id: string | null;
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
  const [unreadMessages, setUnreadMessages] = useState(0);

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

    const { data: completedData, error: completedError } = await supabase
      .from("workout_submissions")
      .select("id, workout_id, workout_title")
      .eq("client_user_id", user.id);

    if (completedError) {
      setStatusMessage(
        "Could not load completed workouts: " + completedError.message
      );
      setIsLoadingCompleted(false);
      setIsLoadingProgram(false);
      return;
    }

    setCompletedSubmissions((completedData || []) as CompletedSubmission[]);
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

  const completedWorkoutIds = useMemo(
    () =>
      completedSubmissions
        .map((submission) => submission.workout_id)
        .filter(Boolean) as string[],
    [completedSubmissions]
  );

  const completedWorkoutTitles = useMemo(
    () => completedSubmissions.map((submission) => submission.workout_title),
    [completedSubmissions]
  );

  function isWorkoutCompleted(workout: PlanWorkout) {
    if (completedWorkoutIds.includes(workout.id)) {
      return true;
    }

    return completedWorkoutTitles.includes(workout.title);
  }

  function getCompletedSubmissionId(workout: PlanWorkout) {
    const exactMatch = completedSubmissions.find(
      (submission) => submission.workout_id === workout.id
    );

    if (exactMatch) {
      return exactMatch.id;
    }

    return completedSubmissions.find(
      (submission) => submission.workout_title === workout.title
    )?.id;
  }

  function isWeekCompleted(week: PlanWeek) {
    const workouts = week.client_plan_workouts || [];

    if (workouts.length === 0) {
      return week.status === "completed";
    }

    return workouts.every((workout) => isWorkoutCompleted(workout));
  }

  const sortedAssignedWeeks = useMemo(() => {
    return [...assignedWeeks].sort((a, b) => {
      const aCompleted = isWeekCompleted(a);
      const bCompleted = isWeekCompleted(b);

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      if (aCompleted && bCompleted) {
        return b.week_number - a.week_number;
      }

      return a.week_number - b.week_number;
    });
  }, [assignedWeeks, completedWorkoutIds, completedWorkoutTitles]);

  const nextAssignedWorkout = useMemo(() => {
    const availableWorkouts = sortedAssignedWeeks
      .filter((week) => week.status !== "locked")
      .flatMap((week) => week.client_plan_workouts || []);

    return [...availableWorkouts]
      .sort((a, b) => {
        const aCompleted = isWorkoutCompleted(a);
        const bCompleted = isWorkoutCompleted(b);

        if (aCompleted !== bCompleted) {
          return aCompleted ? 1 : -1;
        }

        return a.workout_order - b.workout_order;
      })
      .find((workout) => !isWorkoutCompleted(workout));
  }, [sortedAssignedWeeks, completedWorkoutIds, completedWorkoutTitles]);

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            My Plan
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
            View your current workout, upcoming sessions, and completed
            workouts.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard
            title="Weeks"
            value={`${assignedWeeks.length}`}
          />

          <SummaryCard
            title="Completed"
            value={`${completedSubmissions.length}`}
          />

          <SummaryCard
            title="Current"
            value={nextAssignedWorkout?.title || "None"}
            alert={!!nextAssignedWorkout}
          />

          <SummaryCard
            title="Messages"
            value={`${unreadMessages}`}
            alert={unreadMessages > 0}
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        {statusMessage && (
          <p className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold text-slate-700">
            {statusMessage}
          </p>
        )}

        {isLoadingProgram || isLoadingCompleted ? (
          <p className="rounded-2xl bg-sky-50 p-5 text-sm font-semibold text-slate-500">
            Loading your assigned program...
          </p>
        ) : assignedWeeks.length === 0 ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-6">
            <h3 className="text-lg font-black text-slate-900">
              No assigned program yet
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your trainer has not added a program for you yet.
            </p>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {sortedAssignedWeeks.map((week) => {
              const weekCompleted = isWeekCompleted(week);

              const sortedWeekWorkouts = [
                ...(week.client_plan_workouts || []),
              ].sort((a, b) => {
                const aCompleted = isWorkoutCompleted(a);
                const bCompleted = isWorkoutCompleted(b);

                if (aCompleted !== bCompleted) {
                  return aCompleted ? 1 : -1;
                }

                return a.workout_order - b.workout_order;
              });

              return (
                <div
                  key={week.id}
                  className={`rounded-[1.5rem] border p-4 sm:rounded-3xl sm:p-5 ${
                    week.status === "locked"
                      ? "border-slate-200 bg-slate-50 opacity-80"
                      : weekCompleted
                      ? "border-emerald-100 bg-emerald-50 opacity-95"
                      : "border-sky-100 bg-sky-50"
                  }`}
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                        Training Week
                      </p>

                      <h3 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                        Week {week.week_number}
                      </h3>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                        week.status === "locked"
                          ? "bg-red-50 text-red-600 ring-1 ring-red-100"
                          : weekCompleted || week.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                      }`}
                    >
                      {week.status === "locked"
                        ? "Locked / Upcoming"
                        : weekCompleted || week.status === "completed"
                        ? "Completed"
                        : week.status}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {sortedWeekWorkouts.length === 0 ? (
                      <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-500">
                        No workouts added for this week yet.
                      </p>
                    ) : (
                      sortedWeekWorkouts.map((workout) => {
                        const isCompleted = isWorkoutCompleted(workout);
                        const completedSubmissionId =
                          getCompletedSubmissionId(workout);

                        const isCurrentWorkout =
                          week.status !== "locked" &&
                          !isCompleted &&
                          nextAssignedWorkout?.id === workout.id;

                        const isUpcoming = !isCompleted && !isCurrentWorkout;

                        if (isCompleted && completedSubmissionId) {
                          return (
                            <Link
                              key={workout.id}
                              to={`/workout-history/${completedSubmissionId}`}
                              className="block rounded-2xl border border-slate-200 bg-white p-4 opacity-80 shadow-sm transition hover:border-blue-200 hover:opacity-100 hover:shadow-md active:scale-[0.99] sm:p-5"
                            >
                              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h4 className="text-base font-black text-slate-900 sm:text-lg">
                                  {workout.title}
                                </h4>

                                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                                  Completed
                                </span>
                              </div>

                              <WorkoutExerciseList workout={workout} />

                              <div className="mt-4 inline-block rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
                                View Completed Workout →
                              </div>
                            </Link>
                          );
                        }

                        return (
                          <div
                            key={workout.id}
                            className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
                              isCurrentWorkout
                                ? "border-blue-300 bg-white shadow-blue-100"
                                : "border-slate-200 bg-white opacity-75"
                            }`}
                          >
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <h4 className="text-base font-black text-slate-900 sm:text-lg">
                                {workout.title}
                              </h4>

                              {isCurrentWorkout ? (
                                <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                                  Current Workout
                                </span>
                              ) : week.status === "locked" ? (
                                <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600 ring-1 ring-red-100">
                                  Locked
                                </span>
                              ) : isUpcoming ? (
                                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                                  Upcoming
                                </span>
                              ) : null}
                            </div>

                            <WorkoutExerciseList workout={workout} />

                            {isCurrentWorkout ? (
                              <Link
                                to={`/start-workout?workoutId=${workout.id}`}
                                className="mt-4 block w-full rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] sm:inline-block sm:w-auto"
                              >
                                Start Workout →
                              </Link>
                            ) : (
                              <button
                                disabled
                                className="mt-4 w-full cursor-not-allowed rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-500 sm:w-auto"
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
      </section>
    </ClientLayout>
  );
}

function WorkoutExerciseList({ workout }: { workout: PlanWorkout }) {
  const exercises = [...(workout.client_plan_exercises || [])].sort(
    (a, b) => a.exercise_order - b.exercise_order
  );

  if (exercises.length === 0) {
    return (
      <p className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold text-slate-500">
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
          <p className="font-black text-slate-900">{exercise.exercise_name}</p>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {exercise.sets} sets x {exercise.reps} reps • Weight:{" "}
            {exercise.weight || "N/A"} • Rest: {exercise.rest || "N/A"}
          </p>

          {exercise.video_link && (
            <a
              href={exercise.video_link}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="mt-3 inline-block rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-700"
            >
              Watch Video
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  alert = false,
}: {
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        alert ? "border-blue-200 bg-blue-50" : "border-sky-100 bg-sky-50"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2
        className={`mt-2 line-clamp-2 break-words text-xl font-black leading-tight sm:text-2xl ${
          alert ? "text-blue-700" : "text-slate-900"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}