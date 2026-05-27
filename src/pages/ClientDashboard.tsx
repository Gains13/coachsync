import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientData = {
  full_name: string;
  client_id: string;
  setup_complete?: boolean;
};

type GoalData = {
  main_goal: string;
};

type ClientMenuItem = {
  to: string;
  title: string;
  description: string;
  icon: string;
  badge?: number;
};

export default function ClientDashboard() {
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientData | null>(null);
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("coachsync-user-role");
    localStorage.removeItem("coachsync-client-id");
    navigate("/");
  }

  const menuItems = useMemo<ClientMenuItem[]>(
    () => [
      {
        to: "/client-plan",
        title: "My Plan",
        description: "View your workouts and start your next session.",
        icon: "📋",
      },
      {
        to: "/client-messages",
        title: "Messages",
        description: "Read updates and message your trainer.",
        icon: "💬",
        badge: unreadMessages,
      },
      {
        to: "/client-goals",
        title: "Goals",
        description: "View and update your training goals.",
        icon: "🎯",
      },
      {
        to: "/client-assessment",
        title: "Assessment",
        description: "Review your starting results and baseline info.",
        icon: "📊",
      },
      {
        to: "/client-past-workouts",
        title: "Past Workouts",
        description: "See workouts you have already completed.",
        icon: "🕓",
      },
      {
        to: "/client-progress",
        title: "Progress",
        description: "Track your progress over time.",
        icon: "📈",
      },
      {
        to: "/client-settings",
        title: "Settings",
        description: "Manage your account.",
        icon: "⚙️",
      },
    ],
    [unreadMessages]
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sky-50 px-4">
        <div className="rounded-3xl border border-sky-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">
            Loading your dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="min-h-screen bg-sky-50 p-4 text-slate-900 sm:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-black">Client profile not found</h1>

          <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
            Your account exists but no profile has been set up yet. Contact
            your trainer.
          </p>

          <button
            onClick={handleLogout}
            className="mt-5 inline-block rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />

          <aside className="relative flex h-full w-80 max-w-[86vw] flex-col border-r border-sky-100 bg-white shadow-2xl">
            <ClientSidebar
              menuItems={menuItems}
              unreadMessages={unreadMessages}
              closeMenu={() => setMobileMenuOpen(false)}
              handleLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      <div className="sticky top-0 z-30 border-b border-sky-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm font-black text-blue-700 shadow-sm active:scale-[0.98]"
          >
            <span className="text-lg">☰</span>
            Menu
          </button>

          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-black text-slate-900">
              CoachSync
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              Client Portal
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm active:scale-[0.98]"
          >
            Logout
          </button>
        </div>
      </div>

      <section className="mx-auto grid max-w-7xl gap-6 px-3 py-4 sm:px-6 sm:py-8 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
            <ClientSidebar
              menuItems={menuItems}
              unreadMessages={unreadMessages}
              handleLogout={handleLogout}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
            <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                Client Home
              </p>

              <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
                Welcome, {client.full_name}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
                Here’s your training status, latest updates, and quick access
                to your plan.
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

              <SummaryCard
                title="Goal"
                value={goal?.main_goal || "Not set"}
              />
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
                    Open your messages to read the latest update from your
                    trainer.
                  </p>
                </div>

                <span className="w-fit rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white">
                  Open Messages →
                </span>
              </div>
            </Link>
          )}

          <section className="mb-4 rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-6">
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

          <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Menu
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                Client Tools
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Everything you need for your training is here.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {menuItems.map((item) => (
                <DashboardMenuCard key={item.to} item={item} />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function ClientSidebar({
  menuItems,
  unreadMessages,
  closeMenu,
  handleLogout,
}: {
  menuItems: ClientMenuItem[];
  unreadMessages: number;
  closeMenu?: () => void;
  handleLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sky-100 p-4">
        <Link
          to="/client"
          onClick={closeMenu}
          className="flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">
            C
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900">
              CoachSync
            </p>
            <p className="truncate text-xs font-semibold text-slate-500">
              Client Portal
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        <Link
          to="/client"
          onClick={closeMenu}
          className="flex items-center gap-3 rounded-2xl bg-blue-600 p-3 text-sm font-black text-white shadow-sm"
        >
          <span className="text-xl">🏠</span>
          Dashboard
        </Link>

        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={closeMenu}
            className="relative flex items-center gap-3 rounded-2xl border border-transparent p-3 text-sm font-bold text-slate-700 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
          >
            <span className="text-xl">{item.icon}</span>

            <span className="min-w-0 flex-1 truncate">{item.title}</span>

            {item.badge && item.badge > 0 ? (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {unreadMessages > 0 && (
        <div className="mx-4 mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-3">
          <p className="text-sm font-black text-blue-900">
            {unreadMessages} unread message{unreadMessages === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            Check your latest trainer update.
          </p>
        </div>
      )}

      <div className="border-t border-sky-100 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-black text-red-700 transition hover:bg-red-100"
        >
          <span className="text-lg">🚪</span>
          Log out
        </button>
      </div>
    </div>
  );
}

function DashboardMenuCard({ item }: { item: ClientMenuItem }) {
  return (
    <Link
      to={item.to}
      className="relative block rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md active:scale-[0.99]"
    >
      {item.badge && item.badge > 0 ? (
        <span className="absolute right-4 top-4 rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white shadow-sm">
          {item.badge}
        </span>
      ) : null}

      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-sky-100">
        {item.icon}
      </div>

      <h3 className="text-base font-black text-slate-900">{item.title}</h3>

      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
        {item.description}
      </p>

      <p className="mt-3 text-sm font-black text-blue-600">Open →</p>
    </Link>
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