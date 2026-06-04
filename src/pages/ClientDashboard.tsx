import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type ClientData = {
  full_name: string;
  client_id: string;
  setup_complete?: boolean | null;
};

type GoalData = {
  main_goal: string | null;
};

type LastWorkoutData = {
  id: string;
  workout_title?: string | null;
  title?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  date?: string | null;
};

export default function ClientDashboard() {
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientData | null>(null);
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [completedWorkoutCount, setCompletedWorkoutCount] = useState(0);
  const [personalActivityCount, setPersonalActivityCount] = useState(0);
  const [importedWorkoutCount, setImportedWorkoutCount] = useState(0);
  const [lastWorkout, setLastWorkout] = useState<LastWorkoutData | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

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

    const userId = user.id;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, client_id, setup_complete")
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

    if (profileData.setup_complete === false) {
      navigate("/client-setup", { replace: true });
      return;
    }

    setClient(profileData);

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

    const { data: weekData, error: weekError } = await supabase
      .from("client_plan_weeks")
      .select("week_number")
      .eq("client_user_id", userId)
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weekError) {
      console.error(weekError);
    }

    if (weekData) {
      setCurrentWeek(weekData.week_number);
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

    setLoading(false);
  }

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-3xl border border-sky-100 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-600">
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
        <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-black">Client profile not found</h1>

          <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
            Your account exists, but no profile has been set up yet. Contact
            your trainer.
          </p>
        </div>
      </ClientLayout>
    );
  }

  const lastWorkoutTitle =
    lastWorkout?.workout_title || lastWorkout?.title || "No workout completed yet";

  const lastWorkoutDate =
    lastWorkout?.submitted_at || lastWorkout?.completed_at || lastWorkout?.date || null;

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
            Client Home
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            Welcome, {client.full_name}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
            Here’s what to focus on today, your training progress, and any new
            messages from your trainer.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard
            title="Current Week"
            value={currentWeek ? `Week ${currentWeek}` : "Not set"}
          />

          <SummaryCard title="Completed" value={`${completedWorkoutCount}`} />

          <SummaryCard
            title="Messages"
            value={`${unreadMessages}`}
            alert={unreadMessages > 0}
          />

          <SummaryCard title="Goal" value={goal?.main_goal || "Not set"} />
        </div>
      </section>

      {unreadMessages > 0 && (
        <Link
          to="/client-messages"
          className="mb-4 block rounded-[1.5rem] border border-blue-200 bg-blue-50 p-4 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 sm:mb-6 sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-blue-900 sm:text-lg">
                You have {unreadMessages} unread message
                {unreadMessages === 1 ? "" : "s"}
              </h2>

              <p className="mt-1 text-sm leading-6 text-blue-700">
                Open your messages to read the latest update from your trainer.
              </p>
            </div>

            <span className="w-fit rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white">
              Open Messages →
            </span>
          </div>
        </Link>
      )}

      <section className="mb-4 rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Today’s Focus
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
              Start with your current training plan
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Open your plan to see your next assigned workout. Completed
              workouts and imported past workouts are still available in your
              history if you need to review or repeat them.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[430px]">
            <Link
              to="/client-plan"
              className="rounded-2xl bg-blue-600 px-5 py-4 text-center text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
            >
              Open My Plan →
            </Link>

            <Link
              to="/client-past-workouts"
              className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-center text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 active:scale-[0.99]"
            >
              View Past Workouts →
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Last Completed Workout
            </p>

            <h2 className="mt-1 break-words text-xl font-black text-slate-900 sm:text-2xl">
              {lastWorkoutTitle}
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              {lastWorkoutDate
                ? `Completed ${formatDate(lastWorkoutDate)}`
                : "Once you complete a workout, it will show here."}
            </p>
          </div>

          {lastWorkout ? (
            <Link
              to={`/workout-history/${lastWorkout.id}`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] sm:w-auto"
            >
              View Details →
            </Link>
          ) : (
            <Link
              to="/client-plan"
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] sm:w-auto"
            >
              Start Your First Workout →
            </Link>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                Extra Activity
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                Did you exercise on your own?
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Log a hike, bike ride, walk, gym session, at-home workout, or
                any extra training you completed.
              </p>
            </div>

            <Link
              to="/client-log-activity"
              className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] sm:w-auto"
            >
              Log Activity →
            </Link>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:mt-6 sm:rounded-3xl sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Training Snapshot
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
            Your activity so far
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat
            label="Program Workouts"
            value={`${completedWorkoutCount}`}
            description="Completed assigned workouts"
          />

          <MiniStat
            label="Personal Activity"
            value={`${personalActivityCount}`}
            description="Extra workouts you logged"
          />

          <MiniStat
            label="Imported Workouts"
            value={`${importedWorkoutCount}`}
            description="Past workouts from trainer notes"
          />
        </div>
      </section>
    </ClientLayout>
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

function MiniStat({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <h3 className="mt-2 text-2xl font-black text-slate-900">{value}</h3>

      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Date not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}