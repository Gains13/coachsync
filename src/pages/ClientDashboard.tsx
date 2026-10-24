import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Check, Eye, MessageCircle, Play, Plus, PersonStanding, Repeat2 } from "lucide-react";
import { loadLatestSessionForClient, startOfWeek, type Session } from "../lib/sessions";
import ClientLayout from "../components/ClientLayout";

type ClientData = {
  full_name: string;
  client_id: string;
  setup_complete?: boolean | null;
  avatar_url?: string | null;
};

type GoalData = {
  main_goal: string | null;
};

type TrainingPlan = {
  id: string;
  name: string;
  plan_type: "fixed" | "ongoing";
  planned_weeks: number | null;
  status: string;
};

type LastWorkoutData = {
  id: string;
  workout_title?: string | null;
  title?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  date?: string | null;
};

type NextWorkout = {
  id: string;
  title: string;
  weekNumber: number;
  workoutOrder: number;
  exerciseCount: number;
};

type PlanWeekRow = {
  id: string;
  plan_id: string | null;
  week_number: number;
  status: string;
  client_plan_workouts: {
    id: string;
    title: string;
    workout_order: number;
    client_plan_exercises?: { id: string }[];
  }[];
};

type SubmissionRow = {
  workout_id: string | null;
};

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 0) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type ClientDashboardProps = {
  previewClientUserId?: string;
  previewMode?: boolean;
  previewBasePath?: string;
};

export default function ClientDashboard({
  previewClientUserId,
  previewMode = false,
  previewBasePath = "",
}: ClientDashboardProps) {
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientData | null>(null);
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [totalWeeks, setTotalWeeks] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [completedWorkoutCount, setCompletedWorkoutCount] = useState(0);
  const [personalActivityCount, setPersonalActivityCount] = useState(0);
  const [importedWorkoutCount, setImportedWorkoutCount] = useState(0);
  const [lastWorkout, setLastWorkout] = useState<LastWorkoutData | null>(null);
  const [nextWorkout, setNextWorkout] = useState<NextWorkout | null>(null);

  const [weeklyWorkoutTotal, setWeeklyWorkoutTotal] = useState(0);
  const [weeklyWorkoutCompleted, setWeeklyWorkoutCompleted] = useState(0);

  const [latestSession, setLatestSession] = useState<Session | null>(null);
  const [sessionRepeatsThisWeek, setSessionRepeatsThisWeek] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [previewClientUserId]);

  const firstName = useMemo(() => {
    const name = client?.full_name || "there";
    return name.split(" ")[0] || name;
  }, [client]);

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      navigate("/", { replace: true });
      return;
    }

    const userId = previewClientUserId || user.id;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, client_id, setup_complete, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      navigate("/", { replace: true });
      return;
    }

    if (!profileData) {
      setClient(null);
      setLoading(false);
      return;
    }

    if (!previewMode && profileData.setup_complete === false) {
      navigate("/client-setup", { replace: true });
      return;
    }

    setClient(profileData as ClientData);

    const { data: goalData, error: goalError } = await supabase
      .from("client_goals")
      .select("main_goal")
      .eq("client_user_id", userId)
      .maybeSingle();

    if (goalError) {
      console.error(goalError);
    }

    if (goalData) {
      setGoal(goalData);
    }

    const { data: activePlanData, error: activePlanError } = await supabase
      .from("training_plans")
      .select("id, name, plan_type, planned_weeks, status")
      .eq("client_user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activePlanError) {
      console.error(activePlanError);
    }

    const currentPlan = (activePlanData || null) as TrainingPlan | null;
    setActivePlan(currentPlan);

    let weekData: unknown[] = [];
    let weekError: { message: string } | null = null;

    const baseWeekQuery = () =>
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
              id
            )
          )
        `
        )
        .eq("client_user_id", userId)
        .order("week_number", { ascending: true });

    if (currentPlan?.id) {
      const weekResult = await baseWeekQuery().eq("plan_id", currentPlan.id);
      weekData = weekResult.data || [];
      weekError = weekResult.error;

      // Backward-compatible fallback: if the active plan is visible but has no
      // attached weeks, keep existing clients from seeing an empty dashboard.
      if (!weekError && weekData.length === 0) {
        const fallbackResult = await baseWeekQuery();
        weekData = fallbackResult.data || [];
        weekError = fallbackResult.error;
      }
    } else {
      // Some existing clients can read their assigned weeks but do not yet have
      // access to the new training_plans row. Fall back to their assigned weeks.
      const fallbackResult = await baseWeekQuery();
      weekData = fallbackResult.data || [];
      weekError = fallbackResult.error;
    }

    if (weekError) {
      console.error(weekError);
    }

    const weeks = ((weekData || []) as unknown as PlanWeekRow[]).sort(
      (a, b) => a.week_number - b.week_number
    );

    const { data: submittedRows, error: submittedRowsError } = await supabase
      .from("workout_submissions")
      .select("workout_id")
      .eq("client_user_id", userId);

    if (submittedRowsError) {
      console.error(submittedRowsError);
    }

    const submittedWorkoutIds = new Set(
      ((submittedRows || []) as SubmissionRow[])
        .map((row) => row.workout_id)
        .filter(Boolean) as string[]
    );

    const unlockedWeeks = weeks.filter((week) => week.status !== "locked");

    const allAvailableWorkouts = unlockedWeeks.flatMap((week) =>
      [...(week.client_plan_workouts || [])]
        .sort((a, b) => a.workout_order - b.workout_order)
        .map((workout) => ({
          id: workout.id,
          title: workout.title,
          weekNumber: week.week_number,
          workoutOrder: workout.workout_order,
          exerciseCount: workout.client_plan_exercises?.length || 0,
        }))
    );

    const firstIncompleteWorkout =
      allAvailableWorkouts.find(
        (workout) => !submittedWorkoutIds.has(workout.id)
      ) || null;

    setNextWorkout(firstIncompleteWorkout);

    const progressWeekNumber =
      firstIncompleteWorkout?.weekNumber ||
      unlockedWeeks[unlockedWeeks.length - 1]?.week_number ||
      null;

    setCurrentWeek(progressWeekNumber);
    setTotalWeeks(
      Math.max(
        currentPlan?.planned_weeks || 0,
        weeks[weeks.length - 1]?.week_number || 0
      )
    );

    if (progressWeekNumber) {
      const progressWeek = unlockedWeeks.find(
        (week) => week.week_number === progressWeekNumber
      );

      const weekWorkouts = progressWeek?.client_plan_workouts || [];

      setWeeklyWorkoutTotal(weekWorkouts.length);
      setWeeklyWorkoutCompleted(
        weekWorkouts.filter((workout) => submittedWorkoutIds.has(workout.id))
          .length
      );
    } else {
      setWeeklyWorkoutTotal(0);
      setWeeklyWorkoutCompleted(0);
    }

    const { count: unreadCount, error: unreadError } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_user_id", userId)
      .eq("receiver_user_id", userId)
      .is("read_at", null);

    if (unreadError) {
      console.error(unreadError);
    } else {
      setUnreadMessages(unreadCount || 0);
    }

    const { count: completedCount, error: completedError } = await supabase
      .from("workout_submissions")
      .select("id", { count: "exact", head: true })
      .eq("client_user_id", userId);

    if (completedError) {
      console.error(completedError);
    } else {
      setCompletedWorkoutCount(completedCount || 0);
    }

    const { count: personalCount, error: personalError } = await supabase
      .from("personal_workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("client_user_id", userId);

    if (personalError) {
      console.error(personalError);
    } else {
      setPersonalActivityCount(personalCount || 0);
    }

    const { count: importedCount, error: importedError } = await supabase
      .from("client_historical_workouts")
      .select("id", { count: "exact", head: true })
      .eq("client_user_id", userId);

    if (importedError) {
      console.error(importedError);
    } else {
      setImportedWorkoutCount(importedCount || 0);
    }

    const { data: lastWorkoutData, error: lastWorkoutError } = await supabase
      .from("workout_submissions")
      .select("id, workout_title, title, submitted_at, completed_at, date")
      .eq("client_user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastWorkoutError) {
      console.error(lastWorkoutError);
    } else {
      setLastWorkout(lastWorkoutData);
    }

    const session = await loadLatestSessionForClient(userId);
    setLatestSession(session);

    if (session) {
      const { count: repeatCount } = await supabase
        .from("workout_submissions")
        .select("id", { count: "exact", head: true })
        .eq("client_user_id", userId)
        .eq("historical_workout_id", session.id)
        .gte("submitted_at", startOfWeek().toISOString());

      setSessionRepeatsThisWeek(repeatCount || 0);
    } else {
      setSessionRepeatsThisWeek(0);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-line bg-white px-6 py-5 text-center">
            <p className="text-sm font-medium text-muted">
              Loading your dashboard...
            </p>
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (!client) {
    return (
      <ClientLayout>
        <div className="rounded-[18px] border border-line bg-white p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold">
            Client profile not found
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Your account exists, but no profile has been set up yet. Contact
            your trainer.
          </p>
        </div>
      </ClientLayout>
    );
  }

  const lastWorkoutTitle =
    lastWorkout?.workout_title ||
    lastWorkout?.title ||
    "No workout completed yet";

  const lastWorkoutDate =
    lastWorkout?.submitted_at ||
    lastWorkout?.completed_at ||
    lastWorkout?.date ||
    null;

  const weeklyPercent =
    weeklyWorkoutTotal > 0
      ? Math.round((weeklyWorkoutCompleted / weeklyWorkoutTotal) * 100)
      : 0;

  const weeklyRemaining = Math.max(weeklyWorkoutTotal - weeklyWorkoutCompleted, 0);

  const weeklyMessage =
    weeklyWorkoutTotal === 0
      ? "No workouts scheduled this week yet."
      : weeklyRemaining === 0
        ? "Week complete. Nice work."
        : weeklyRemaining === 1
          ? "One more to hit your week. Keep it going."
          : `${weeklyRemaining} more to hit your week. Keep it going.`;

  const planName = activePlan?.name || "Your training plan";
  const planWeekLabel =
    currentWeek && totalWeeks
      ? `Week ${currentWeek} of ${totalWeeks}`
      : currentWeek
        ? `Week ${currentWeek}`
        : "";

  function previewHref(clientHref: string) {
    if (!previewMode || !previewBasePath) return clientHref;

    const [pathname, search = ""] = clientHref.split("?");

    const routeMap: Record<string, string> = {
      "/client": "",
      "/client-plan": "/plan",
      "/client-past-workouts": "/past-workouts",
      "/client-messages": "/messages",
      "/client-progress": "/progress",
      "/client-settings": "/settings",
      "/client-log-activity": "/log-activity",
    };

    if (pathname === "/start-workout" || pathname === "/preview-workout") {
      const params = new URLSearchParams(search);
      const workoutId = params.get("workoutId");
      return workoutId
        ? `${previewBasePath}/workout/${workoutId}`
        : `${previewBasePath}/plan`;
    }

    if (pathname.startsWith("/workout-history/")) {
      const submissionId = pathname.split("/").pop();
      return `${previewBasePath}/completed/${submissionId}`;
    }

    return `${previewBasePath}${routeMap[pathname] ?? ""}`;
  }

  return (
    <DashboardFrame
      previewMode={previewMode}
      unreadMessages={unreadMessages}
      clientName={client.full_name}
      clientUserId={previewClientUserId || ""}
    >
      {/* Header */}
      <header className="mb-4 flex items-center gap-3 lg:mb-5 lg:items-start lg:justify-between">
        <Link
          to={previewHref("/client-settings")}
          aria-label="Edit profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink text-sm font-bold text-white lg:hidden"
        >
          {client.avatar_url ? (
            <img
              src={client.avatar_url}
              alt={`${client.full_name} profile`}
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(client.full_name)
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">Today</p>
          <h1 className="font-display text-[22px] font-bold leading-tight tracking-tight sm:text-[30px]">
            Welcome back, {firstName}
          </h1>
        </div>

        {activePlan || currentWeek ? (
          <Link
            to={previewHref("/client-plan")}
            className="hidden items-center gap-4 rounded-2xl border border-line bg-white px-4 py-2.5 transition hover:border-accent/30 lg:flex"
          >
            <div className="min-w-0">
              <p className="text-xs text-muted">Current plan</p>
              <p className="truncate text-sm font-semibold">
                {planName}
                {planWeekLabel ? ` · ${planWeekLabel}` : ""}
              </p>
            </div>
            <WeekSegments current={currentWeek} total={totalWeeks} compact />
          </Link>
        ) : null}
      </header>

      {/* Plan progress (mobile) */}
      {(activePlan || currentWeek) && (
        <Link
          to={previewHref("/client-plan")}
          className="mb-4 block rounded-2xl border border-line bg-white px-4 py-3 lg:hidden"
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{planName}</span>
            {planWeekLabel && (
              <span className="shrink-0 text-muted">{planWeekLabel}</span>
            )}
          </div>
          <WeekSegments current={currentWeek} total={totalWeeks} />
        </Link>
      )}

      {unreadMessages > 0 && (
        <Link
          to={previewHref("/client-messages")}
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent-soft px-4 py-3 transition hover:border-accent/40"
        >
          <div className="flex min-w-0 items-center gap-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-accent" />
            <p className="truncate text-sm font-semibold">
              {unreadMessages} unread message{unreadMessages === 1 ? "" : "s"}{" "}
              from your trainer
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-accent">
            Open
          </span>
        </Link>
      )}

      {/* Next up + this week */}
      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        {!nextWorkout && latestSession ? (
          <SessionCard
            session={latestSession}
            repeatsThisWeek={sessionRepeatsThisWeek}
            previewMode={previewMode}
            dark
          />
        ) : (
        <section className="rounded-[22px] bg-ink p-5 text-white sm:p-7">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
              Next up
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {nextWorkout ? "Ready" : "All done"}
            </span>
          </div>

          <h2 className="mt-4 break-words font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-4xl">
            {nextWorkout ? formatWorkoutTitle(nextWorkout) : "You’re caught up"}
          </h2>

          <p className="mt-1.5 text-sm text-white/65">
            {nextWorkout
              ? `Week ${nextWorkout.weekNumber} · ${nextWorkout.exerciseCount} movement${
                  nextWorkout.exerciseCount === 1 ? "" : "s"
                }`
              : "Review your plan, repeat a past workout, or log extra activity."}
          </p>

          <div className="mt-5 flex gap-2.5 sm:mt-6">
            {nextWorkout ? (
              <>
                {previewMode ? (
                  <button
                    type="button"
                    disabled
                    className="flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-xl bg-white/10 px-5 text-sm font-semibold text-white/60 sm:flex-none"
                  >
                    Start workout — client only
                  </button>
                ) : (
                  <Link
                    to={`/start-workout?workoutId=${nextWorkout.id}`}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent-dark active:scale-[0.99] sm:flex-none"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    Start workout
                  </Link>
                )}

                <Link
                  to={previewHref(`/preview-workout?workoutId=${nextWorkout.id}`)}
                  aria-label="Preview workout"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 text-sm font-semibold text-white transition hover:bg-white/5 sm:w-auto sm:px-5"
                >
                  <Eye className="h-5 w-5 sm:hidden" />
                  <span className="hidden sm:inline">Preview workout</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to={previewHref("/client-plan")}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent-dark sm:flex-none"
                >
                  Open my plan
                </Link>
                <Link
                  to={previewHref("/client-past-workouts")}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white transition hover:bg-white/5 sm:flex-none"
                >
                  Past workouts
                </Link>
              </>
            )}
          </div>
        </section>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
          {/* This week: compact bar on mobile, ring on desktop */}
          <section className="rounded-[18px] border border-line bg-white p-4 lg:flex lg:flex-col lg:justify-between lg:p-6">
            <p className="text-sm font-medium text-muted lg:font-display lg:text-[17px] lg:font-semibold lg:text-ink">
              This week
            </p>

            <div className="lg:hidden">
              <p className="mt-2 font-display text-2xl font-bold">
                {weeklyWorkoutCompleted} of {weeklyWorkoutTotal}
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-canvas">
                <div
                  className="h-1.5 rounded-full bg-accent transition-all"
                  style={{ width: `${weeklyPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-5 hidden items-center gap-5 lg:flex">
              <ProgressRing percent={weeklyPercent} />
              <div>
                <p className="font-display text-2xl font-bold">
                  {weeklyWorkoutCompleted} of {weeklyWorkoutTotal}
                </p>
                <p className="text-sm text-muted">workouts done</p>
              </div>
            </div>

            <p className="mt-5 hidden text-sm text-muted lg:block">
              {weeklyMessage}
            </p>
          </section>

          {/* Log activity: mobile tile */}
          <Link
            to={previewHref("/client-log-activity")}
            className="rounded-[18px] border border-line bg-white p-4 transition hover:border-violet-200 lg:hidden"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Plus className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[15px] font-semibold">Log activity</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              Walk, hike, ride...
            </p>
          </Link>
        </div>
      </div>

      {/* Clients on a program who also train in person */}
      {nextWorkout && latestSession && (
        <div className="mt-4">
          <SessionCard
            session={latestSession}
            repeatsThisWeek={sessionRepeatsThisWeek}
            previewMode={previewMode}
          />
        </div>
      )}

      {/* Last completed + log activity (desktop) */}
      <div className="mt-4 hidden gap-4 lg:grid lg:grid-cols-2">
        <section className="flex items-center gap-4 rounded-[18px] border border-line bg-white p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Check className="h-5 w-5" strokeWidth={2.5} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Last completed</p>
            <p className="truncate text-sm font-semibold">{lastWorkoutTitle}</p>
            <p className="text-sm text-muted">
              {lastWorkoutDate
                ? formatDateTime(lastWorkoutDate)
                : "Your first workout will show here."}
            </p>
          </div>

          {lastWorkout && (
            <Link
              to={previewHref(`/workout-history/${lastWorkout.id}`)}
              className="text-sm font-semibold text-accent hover:underline"
            >
              View
            </Link>
          )}
        </section>

        <section className="flex items-center gap-4 rounded-[18px] border border-line bg-white p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <PersonStanding className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Trained on your own?</p>
            <p className="text-sm text-muted">
              Log a walk, gym session, hike or ride.
            </p>
          </div>

          <Link
            to={previewHref("/client-log-activity")}
            className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/85"
          >
            Log activity
          </Link>
        </section>
      </div>

      {/* Activity so far */}
      <section className="mt-4 rounded-[18px] border border-line bg-white p-4 lg:p-6">
        <div className="mb-3 flex items-center justify-between lg:mb-5">
          <h2 className="text-[15px] font-semibold lg:font-display lg:text-lg">
            Your activity so far
          </h2>
          <Link
            to={previewHref("/client-progress")}
            className="hidden text-sm font-semibold text-accent hover:underline lg:block"
          >
            See progress
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat
            label="Program workouts"
            shortLabel="Program"
            value={completedWorkoutCount}
            description="Assigned workouts completed"
          />
          <MiniStat
            label="Personal activity"
            shortLabel="Personal"
            value={personalActivityCount}
            description="Extra workouts you logged"
          />
          <MiniStat
            label="Imported workouts"
            shortLabel="Imported"
            value={importedWorkoutCount}
            description="From your trainer’s notes"
          />
        </div>
      </section>
    </DashboardFrame>
  );
}

function SessionCard({
  session,
  repeatsThisWeek,
  previewMode,
  dark = false,
}: {
  session: Session;
  repeatsThisWeek: number;
  previewMode: boolean;
  dark?: boolean;
}) {
  const exerciseNames = session.exercises
    .map((exercise) => exercise.exerciseName)
    .filter(Boolean);

  const repeatLabel =
    repeatsThisWeek === 0
      ? "Not repeated yet this week"
      : `Repeated ${repeatsThisWeek}× this week`;

  return (
    <section
      className={
        dark
          ? "rounded-[22px] bg-ink p-5 text-white sm:p-7"
          : "flex flex-wrap items-center gap-4 rounded-[18px] border border-line bg-white p-5"
      }
    >
      <div className={dark ? "" : "min-w-[220px] flex-1"}>
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
              dark ? "bg-accent text-white" : "bg-accent-soft text-accent"
            }`}
          >
            Your last session
          </span>
          <span
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              dark ? "text-emerald-300" : "text-emerald-700"
            }`}
          >
            <Repeat2 className="h-3.5 w-3.5" />
            {repeatLabel}
          </span>
        </div>

        <h2
          className={`break-words font-display font-extrabold tracking-tight ${
            dark ? "mt-4 text-[26px] leading-tight sm:text-4xl" : "mt-2 text-xl"
          }`}
        >
          {session.title || "Training session"}
        </h2>

        <p className={`mt-1.5 text-sm ${dark ? "text-white/65" : "text-muted"}`}>
          {formatSessionDate(session.workoutDate)} · {session.exercises.length} exercise
          {session.exercises.length === 1 ? "" : "s"}
          {exerciseNames.length > 0 && ` · ${exerciseNames.slice(0, 3).join(", ")}`}
          {exerciseNames.length > 3 && "..."}
        </p>
      </div>

      <div className={`flex gap-2.5 ${dark ? "mt-5 sm:mt-6" : ""}`}>
        {previewMode ? (
          <span
            className={`flex h-12 flex-1 items-center justify-center rounded-xl px-5 text-sm font-semibold ${
              dark ? "bg-white/10 text-white/60" : "bg-canvas text-muted"
            }`}
          >
            Repeat — client only
          </span>
        ) : (
          <Link
            to={`/repeat-historical-workout/${session.id}`}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent-dark sm:flex-none"
          >
            <Repeat2 className="h-4 w-4" />
            Repeat this workout
          </Link>
        )}
        {!previewMode && (
          <Link
            to={`/client-historical-workout/${session.id}`}
            className={`flex h-12 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition ${
              dark
                ? "border-white/15 text-white hover:bg-white/5"
                : "border-line text-ink hover:bg-canvas"
            }`}
          >
            View
          </Link>
        )}
      </div>
    </section>
  );
}

function formatSessionDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function DashboardFrame({
  previewMode,
  unreadMessages,
  clientName,
  clientUserId,
  children,
}: {
  previewMode: boolean;
  unreadMessages: number;
  clientName: string;
  clientUserId: string;
  children: ReactNode;
}) {
  if (!previewMode) {
    return <ClientLayout unreadMessages={unreadMessages}>{children}</ClientLayout>;
  }

  return (
    <main className="min-h-screen bg-canvas font-sans text-ink">
      <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
              Trainer Client Preview
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Viewing {clientName} as a trainer. Navigation works, but actions that change client data are blocked.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to={`/clients/${clientUserId}`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Back to Client Details
            </Link>

            <Link
              to="/clients"
              className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800 hover:bg-amber-100"
            >
              Client List
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
        {children}
      </div>
    </main>
  );
}

function WeekSegments({
  current,
  total,
  compact = false,
}: {
  current: number | null;
  total: number;
  compact?: boolean;
}) {
  if (!total) return null;

  return (
    <div className={`flex ${compact ? "w-[120px] gap-1" : "gap-1.5"}`}>
      {Array.from({ length: total }, (_, index) => {
        const week = index + 1;
        const color =
          current && week < current
            ? "bg-accent"
            : current === week
              ? "bg-accent/40"
              : "bg-line";

        return (
          <span key={week} className={`h-1.5 flex-1 rounded-full ${color}`} />
        );
      })}
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative h-[92px] w-[92px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="9"
          className="stroke-canvas"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-accent transition-all"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold">
        {percent}%
      </span>
    </div>
  );
}

function MiniStat({
  label,
  shortLabel,
  value,
  description,
}: {
  label: string;
  shortLabel: string;
  value: number;
  description: string;
}) {
  return (
    <div className="lg:rounded-2xl lg:bg-canvas lg:p-5">
      <p className="font-display text-2xl font-bold lg:text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted lg:hidden">{shortLabel}</p>
      <p className="mt-2 hidden text-sm font-semibold lg:block">{label}</p>
      <p className="mt-0.5 hidden text-sm text-muted lg:block">{description}</p>
    </div>
  );
}

function formatWorkoutTitle(workout: NextWorkout) {
  if (/^day\s*\d/i.test(workout.title)) return workout.title;
  return `Day ${workout.workoutOrder} · ${workout.title}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${time}`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
