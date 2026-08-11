import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type CompletedSubmission = {
  id: string;
  workout_id: string | null;
  workout_title: string;
};

type TrainingPlan = {
  id: string;
  name: string;
  plan_type: "fixed" | "ongoing";
  planned_weeks: number | null;
  status: string;
};

type PlanExercise = {
  id: string;
  section?: string | null;
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
  plan_id: string | null;
  week_number: number;
  status: string;
  client_plan_workouts: PlanWorkout[];
};

export default function ClientPlan() {
  const [completedSubmissions, setCompletedSubmissions] = useState<
    CompletedSubmission[]
  >([]);

  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
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

    const { data: activePlanData, error: activePlanError } = await supabase
      .from("training_plans")
      .select("id, name, plan_type, planned_weeks, status")
      .eq("client_user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activePlanError) {
      console.error(activePlanError);
    }

    const currentPlan = (activePlanData || null) as TrainingPlan | null;
    setActivePlan(currentPlan);

    let programData: unknown[] = [];
    let programError: { message: string } | null = null;

    const baseProgramQuery = () =>
      supabase
        .from("client_plan_weeks")
        .select(
          `
          id,
          plan_id,
          week_number,
          status,
          client_plan_workouts (
            id,
            title,
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
        .eq("client_user_id", user.id)
        .order("week_number", { ascending: true });

    if (currentPlan?.id) {
      const programResult = await baseProgramQuery().eq("plan_id", currentPlan.id);
      programData = programResult.data || [];
      programError = programResult.error;

      // Backward-compatible fallback for existing clients whose weeks have not
      // been attached to the active training plan yet.
      if (!programError && programData.length === 0) {
        const fallbackResult = await baseProgramQuery();
        programData = fallbackResult.data || [];
        programError = fallbackResult.error;
      }
    } else {
      // If the client cannot see an active training_plans row, still show the
      // assigned weeks they are allowed to read instead of displaying 0 weeks.
      const fallbackResult = await baseProgramQuery();
      programData = fallbackResult.data || [];
      programError = fallbackResult.error;
    }

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

  function isWorkoutCompleted(workout: PlanWorkout) {
    return completedWorkoutIds.includes(workout.id);
  }

  function getCompletedSubmissionId(workout: PlanWorkout) {
    return completedSubmissions.find(
      (submission) => submission.workout_id === workout.id
    )?.id;
  }

  function isWeekCompleted(week: PlanWeek) {
    const workouts = week.client_plan_workouts || [];

    if (workouts.length === 0) {
      return week.status === "completed";
    }

    return workouts.every((workout) => isWorkoutCompleted(workout));
  }

  const activeAssignedWeeks = useMemo(() => {
    return assignedWeeks.filter((week) => !isWeekCompleted(week));
  }, [assignedWeeks, completedWorkoutIds]);

  const completedWeekCount = useMemo(() => {
    return assignedWeeks.filter((week) => isWeekCompleted(week)).length;
  }, [assignedWeeks, completedWorkoutIds]);

  const sortedActiveWeeks = useMemo(() => {
    return [...activeAssignedWeeks].sort((a, b) => {
      if (a.status === "locked" && b.status !== "locked") return 1;
      if (a.status !== "locked" && b.status === "locked") return -1;

      return a.week_number - b.week_number;
    });
  }, [activeAssignedWeeks]);

  const nextAssignedWorkout = useMemo(() => {
    const availableWorkouts = sortedActiveWeeks
      .filter((week) => week.status !== "locked")
      .flatMap((week) =>
        [...(week.client_plan_workouts || [])]
          .sort((a, b) => a.workout_order - b.workout_order)
          .map((workout) => ({
            ...workout,
            weekStatus: week.status,
            weekNumber: week.week_number,
          }))
      );

    return availableWorkouts.find((workout) => !isWorkoutCompleted(workout));
  }, [sortedActiveWeeks, completedWorkoutIds]);

  const activeWorkoutCount = useMemo(() => {
    return activeAssignedWeeks.reduce(
      (total, week) => total + (week.client_plan_workouts || []).length,
      0
    );
  }, [activeAssignedWeeks]);

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
            {activePlan
              ? `${activePlan.name}: view your current workout and upcoming sessions.`
              : "View your current workout and upcoming sessions."} Completed weeks
            move out of this tab and stay in Past Workouts.
          </p>
        </div>

        {activePlan && (
          <div className="mx-3 mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:mx-6 sm:mt-6 md:mx-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Current Plan</p>
            <p className="mt-1 text-lg font-black text-slate-900">
              {activePlan.name}
              {activePlan.plan_type === "fixed" && activePlan.planned_weeks
                ? ` • ${activePlan.planned_weeks} weeks`
                : ""}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard title="Active Weeks" value={`${activeAssignedWeeks.length}`} />

          <SummaryCard title="Completed Weeks" value={`${completedWeekCount}`} />

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
        ) : sortedActiveWeeks.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
            <h3 className="text-lg font-black text-slate-900">
              All assigned workouts completed
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Great job. Your completed workouts have moved to Past Workouts.
            </p>

            <Link
              to="/client-past-workouts"
              className="mt-5 inline-block rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
            >
              View Past Workouts →
            </Link>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {sortedActiveWeeks.map((week) => {
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

              const incompleteWorkouts = sortedWeekWorkouts.filter(
                (workout) => !isWorkoutCompleted(workout)
              );

              const completedWorkouts = sortedWeekWorkouts.filter((workout) =>
                isWorkoutCompleted(workout)
              );

              const weekIncompleteCount = incompleteWorkouts.length;
              const weekCompletedCount = completedWorkouts.length;
              const weekTotalCount = sortedWeekWorkouts.length;

              return (
                <div
                  key={week.id}
                  className={`rounded-[1.5rem] border p-4 sm:rounded-3xl sm:p-5 ${
                    week.status === "locked"
                      ? "border-slate-200 bg-slate-50 opacity-80"
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

                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {weekCompletedCount} / {weekTotalCount} workout
                        {weekTotalCount === 1 ? "" : "s"} completed
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                        week.status === "locked"
                          ? "bg-red-50 text-red-600 ring-1 ring-red-100"
                          : "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                      }`}
                    >
                      {week.status === "locked"
                        ? "Locked / Upcoming"
                        : `${weekIncompleteCount} remaining`}
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
                              className="block rounded-2xl border border-slate-200 bg-white p-4 opacity-70 shadow-sm transition hover:border-blue-200 hover:opacity-100 hover:shadow-md active:scale-[0.99] sm:p-5"
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

      {!isLoadingProgram && !isLoadingCompleted && activeWorkoutCount > 0 && (
        <p className="mt-4 text-center text-xs font-semibold text-slate-400">
          Completed workouts will stay visible here until the whole week is done.
          Once the week is completed, it moves out of My Plan and remains in Past
          Workouts.
        </p>
      )}
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
          {exercise.section && (
            <p className="mb-1 text-xs font-black uppercase tracking-wide text-blue-600">
              {exercise.section}
            </p>
          )}

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