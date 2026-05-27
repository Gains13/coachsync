import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type ClientData = {
  full_name: string;
  client_id: string;
  setup_complete?: boolean;
};

type GoalData = {
  main_goal: string;
};

export default function ClientDashboard() {
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientData | null>(null);
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      navigate("/");
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
      navigate("/");
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
            Your account exists but no profile has been set up yet. Contact
            your trainer.
          </p>
        </div>
      </ClientLayout>
    );
  }

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
            Here’s your training status, latest updates, and quick access to
            your plan.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard
            title="Week"
            value={currentWeek ? `Week ${currentWeek}` : "Not set"}
          />

          <SummaryCard title="Status" value="Active" />

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

      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Today’s Focus
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
              Ready for your next workout?
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Open your plan to see your current workout, upcoming sessions,
              and completed workouts.
            </p>
          </div>

          <Link
            to="/client-plan"
            className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] sm:w-auto"
          >
            Open My Plan →
          </Link>
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