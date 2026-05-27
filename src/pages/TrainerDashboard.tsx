import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { logoutUser } from "../lib/authHelpers";

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type MessageRow = {
  id: string;
  client_user_id: string;
  sender_user_id: string;
  receiver_user_id: string | null;
  message_body: string;
  created_at: string;
  read_at: string | null;
};

type SubmissionExercise = {
  id: string;
  exercise_name: string;
  completed: boolean;
  difficulty: string | null;
  notes: string | null;
};

type WorkoutSubmission = {
  id: string;
  client_user_id: string;
  workout_title: string;
  submitted_at: string;
  notes: string | null;
  workout_submission_exercises: SubmissionExercise[];
};

type ActivityItem = {
  id: string;
  type: "message" | "workout" | "note";
  title: string;
  description: string;
  clientUserId: string;
  clientName: string;
  createdAt: string;
  link: string;
};

type SidebarItem = {
  to: string;
  title: string;
  icon: string;
  badge?: number;
};

export default function TrainerDashboard() {
  const displayName =
    localStorage.getItem("coachsync-display-name") || "Trainer";

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [trainerUserId, setTrainerUserId] = useState("");
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadTrainerDashboardData();
  }, []);

  async function loadTrainerDashboardData() {
    setIsLoadingActivity(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("Could not load trainer account.");
      setIsLoadingActivity(false);
      return;
    }

    setTrainerUserId(user.id);

    const { data: messagesData, error: messagesError } = await supabase
      .from("messages")
      .select(
        "id, client_user_id, sender_user_id, receiver_user_id, message_body, created_at, read_at"
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (messagesError) {
      console.error(messagesError);
      setStatusMessage("Could not load messages: " + messagesError.message);
    } else {
      setMessages((messagesData || []) as MessageRow[]);
    }

    const { data: submissionsData, error: submissionsError } = await supabase
      .from("workout_submissions")
      .select(
        `
        id,
        client_user_id,
        workout_title,
        submitted_at,
        notes,
        workout_submission_exercises (
          id,
          exercise_name,
          completed,
          difficulty,
          notes
        )
      `
      )
      .order("submitted_at", { ascending: false })
      .limit(20);

    if (submissionsError) {
      console.error(submissionsError);
      setStatusMessage(
        "Could not load workout activity: " + submissionsError.message
      );
    } else {
      setSubmissions((submissionsData || []) as WorkoutSubmission[]);
    }

    const clientIds = Array.from(
      new Set([
        ...(messagesData || []).map((message) => message.client_user_id),
        ...(submissionsData || []).map(
          (submission) => submission.client_user_id
        ),
      ])
    );

    if (clientIds.length > 0) {
      const { data: clientData, error: clientError } = await supabase
        .from("profiles")
        .select("id, full_name, client_id")
        .in("id", clientIds);

      if (clientError) {
        console.error(clientError);
        setStatusMessage(
          "Activity loaded, but client names could not be loaded: " +
            clientError.message
        );
      } else {
        setClients((clientData || []) as ClientProfile[]);
      }
    }

    setIsLoadingActivity(false);
  }

  function getClientName(clientUserId: string) {
    const client = clients.find((client) => client.id === clientUserId);

    if (!client) return "Unknown Client";

    return client.full_name || client.client_id || "Unknown Client";
  }

  function getClientId(clientUserId: string) {
    const client = clients.find((client) => client.id === clientUserId);

    return client?.client_id || "Not set";
  }

  function getCompletionPercent(submission: WorkoutSubmission) {
    const exercises = submission.workout_submission_exercises || [];
    const total = exercises.length;
    const completed = exercises.filter((exercise) => exercise.completed).length;

    if (total === 0) return 0;

    return Math.round((completed / total) * 100);
  }

  const unreadClientMessages = useMemo(() => {
    return messages.filter((message) => {
      const sentByTrainer = message.sender_user_id === trainerUserId;

      return !sentByTrainer && message.read_at === null;
    });
  }, [messages, trainerUserId]);

  const recentWorkoutSubmissions = useMemo(() => {
    return submissions.slice(0, 5);
  }, [submissions]);

  const exerciseNotes = useMemo(() => {
    return submissions.flatMap((submission) => {
      return (submission.workout_submission_exercises || [])
        .filter((exercise) => exercise.notes && exercise.notes.trim() !== "")
        .map((exercise) => ({
          submission,
          exercise,
        }));
    });
  }, [submissions]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const messageActivities: ActivityItem[] = unreadClientMessages.map(
      (message) => ({
        id: `message-${message.id}`,
        type: "message",
        title: "New client message",
        description: message.message_body,
        clientUserId: message.client_user_id,
        clientName: getClientName(message.client_user_id),
        createdAt: message.created_at,
        link: "/messages",
      })
    );

    const workoutActivities: ActivityItem[] = recentWorkoutSubmissions.map(
      (submission) => ({
        id: `workout-${submission.id}`,
        type: "workout",
        title: `${submission.workout_title} completed`,
        description: `${getCompletionPercent(submission)}% complete`,
        clientUserId: submission.client_user_id,
        clientName: getClientName(submission.client_user_id),
        createdAt: submission.submitted_at,
        link: `/workout-history/${submission.id}`,
      })
    );

    const noteActivities: ActivityItem[] = exerciseNotes.map(
      ({ submission, exercise }) => ({
        id: `note-${exercise.id}`,
        type: "note",
        title: `Exercise note: ${exercise.exercise_name}`,
        description: exercise.notes || "No note",
        clientUserId: submission.client_user_id,
        clientName: getClientName(submission.client_user_id),
        createdAt: submission.submitted_at,
        link: `/workout-history/${submission.id}`,
      })
    );

    return [...messageActivities, ...workoutActivities, ...noteActivities]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 8);
  }, [
    unreadClientMessages,
    recentWorkoutSubmissions,
    exerciseNotes,
    clients,
    trainerUserId,
  ]);

  const notificationCount =
    unreadClientMessages.length +
    recentWorkoutSubmissions.length +
    exerciseNotes.length;

  const sidebarItems: SidebarItem[] = [
    {
      to: "/clients",
      title: "Clients",
      icon: "👥",
    },
    {
      to: "/create-client",
      title: "Create Client",
      icon: "➕",
    },
    {
      to: "/create-program",
      title: "Create Program",
      icon: "📋",
    },
    {
      to: "/messages",
      title: "Messages",
      icon: "💬",
      badge: unreadClientMessages.length,
    },
    {
      to: "/workout-tracker",
      title: "Workout Tracker",
      icon: "🏋️",
      badge: exerciseNotes.length,
    },
    {
      to: "/workout-history",
      title: "Workout History",
      icon: "🕓",
      badge: recentWorkoutSubmissions.length,
    },
    {
      to: "/program",
      title: "Templates",
      icon: "📚",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className={`hidden border-r border-sky-100 bg-white shadow-sm transition-all duration-300 lg:block ${
            sidebarOpen ? "w-72" : "w-24"
          }`}
        >
          <SidebarContent
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            sidebarItems={sidebarItems}
          />
        </aside>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            />

            <aside className="relative h-full w-80 max-w-[86vw] border-r border-sky-100 bg-white shadow-2xl">
              <SidebarContent
                sidebarOpen={true}
                setSidebarOpen={setSidebarOpen}
                sidebarItems={sidebarItems}
                closeMobile={() => setMobileSidebarOpen(false)}
              />
            </aside>
          </div>
        )}

        <section className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 border-b border-sky-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm active:scale-[0.98]"
              >
                <span className="text-lg">☰</span>
                Menu
              </button>

              <div className="min-w-0 text-center">
                <p className="truncate text-sm font-black text-slate-900">
                  CoachSync
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Trainer Portal
                </p>
              </div>

              <button
                onClick={logoutUser}
                className="rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm active:scale-[0.98]"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-8 sm:rounded-[2rem]">
              <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                      CoachSync Trainer Dashboard
                    </p>

                    <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
                      Welcome, {displayName}
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
                      You have{" "}
                      <span className="font-bold text-white">
                        {notificationCount}
                      </span>{" "}
                      activity updates to review.
                    </p>
                  </div>

                  <button
                    onClick={logoutUser}
                    className="hidden rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 lg:block"
                  >
                    Log out
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
                <SummaryCard
                  title="Messages"
                  value={`${unreadClientMessages.length}`}
                  alert={unreadClientMessages.length > 0}
                />

                <SummaryCard
                  title="Workouts"
                  value={`${recentWorkoutSubmissions.length}`}
                  alert={recentWorkoutSubmissions.length > 0}
                />

                <SummaryCard
                  title="Notes"
                  value={`${exerciseNotes.length}`}
                  alert={exerciseNotes.length > 0}
                />

                <SummaryCard
                  title="Alerts"
                  value={`${notificationCount}`}
                  alert={notificationCount > 0}
                />
              </div>
            </section>

            {statusMessage && (
              <p className="mb-4 rounded-2xl border border-sky-100 bg-white p-4 text-sm font-medium leading-6 text-slate-700 shadow-sm sm:mb-6">
                {statusMessage}
              </p>
            )}

            <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:mb-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                    Priority Activity
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                    Activity Center
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    New messages, completed workouts, and exercise notes from
                    your clients.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadTrainerDashboardData}
                  className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-center text-sm font-bold text-blue-700 transition hover:bg-blue-50 active:scale-[0.99] sm:w-auto"
                >
                  Refresh
                </button>
              </div>

              {isLoadingActivity ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm font-semibold text-slate-600">
                  Loading dashboard activity...
                </div>
              ) : activityItems.length === 0 ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                  <h3 className="font-black text-slate-900">
                    No new activity yet
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Client messages, workout submissions, and exercise notes
                    will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {activityItems.map((item) => (
                    <ActivityCard
                      key={item.id}
                      item={item}
                      clientId={getClientId(item.clientUserId)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarContent({
  sidebarOpen,
  setSidebarOpen,
  sidebarItems,
  closeMobile,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  sidebarItems: SidebarItem[];
  closeMobile?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-sky-100 p-4">
        <Link
          to="/trainer"
          onClick={closeMobile}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">
            C
          </div>

          {sidebarOpen && (
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900">
                CoachSync
              </p>

              <p className="truncate text-xs font-medium text-slate-500">
                Trainer Portal
              </p>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-black text-blue-700 hover:bg-blue-50 lg:block"
        >
          {sidebarOpen ? "‹" : "›"}
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {sidebarItems.map((item) => (
          <SidebarLink
            key={item.to}
            item={item}
            sidebarOpen={sidebarOpen}
            closeMobile={closeMobile}
          />
        ))}
      </nav>

      <div className="border-t border-sky-100 p-4">
        <button
          type="button"
          onClick={logoutUser}
          className={`flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 transition hover:bg-red-100 ${
            sidebarOpen ? "justify-start" : "justify-center"
          }`}
        >
          <span className="text-lg">🚪</span>

          {sidebarOpen && <span>Log out</span>}
        </button>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  sidebarOpen,
  closeMobile,
}: {
  item: SidebarItem;
  sidebarOpen: boolean;
  closeMobile?: () => void;
}) {
  return (
    <Link
      to={item.to}
      onClick={closeMobile}
      className={`group relative flex items-center gap-3 rounded-2xl border border-transparent p-3 text-sm font-bold text-slate-700 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700 ${
        sidebarOpen ? "justify-start" : "justify-center"
      }`}
    >
      <span className="text-xl">{item.icon}</span>

      {sidebarOpen && (
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
      )}

      {item.badge && item.badge > 0 ? (
        <span
          className={`rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white ${
            sidebarOpen ? "" : "absolute right-1 top-1"
          }`}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function ActivityCard({
  item,
  clientId,
}: {
  item: ActivityItem;
  clientId: string;
}) {
  const typeStyles = {
    message: {
      icon: "💬",
      label: "Message",
      badge: "bg-blue-50 text-blue-700 ring-blue-100",
    },
    workout: {
      icon: "✅",
      label: "Workout",
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    note: {
      icon: "📝",
      label: "Exercise Note",
      badge: "bg-amber-50 text-amber-700 ring-amber-100",
    },
  };

  const style = typeStyles[item.type];

  return (
    <Link
      to={item.link}
      className="block rounded-2xl border border-sky-100 bg-sky-50 p-4 transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md active:scale-[0.99] sm:rounded-3xl sm:p-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg ring-1 ring-sky-100 sm:h-11 sm:w-11 sm:text-xl">
              {style.icon}
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${style.badge}`}
            >
              {style.label}
            </span>
          </div>

          <h3 className="break-words text-base font-black leading-snug text-slate-900 sm:text-lg">
            {item.title}
          </h3>

          <p className="mt-1 text-sm font-bold text-slate-700">
            {item.clientName}
          </p>

          <p className="text-xs font-medium text-slate-500">
            Client ID: {clientId}
          </p>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
            {item.description}
          </p>
        </div>

        <div className="shrink-0 text-xs font-medium text-slate-400 sm:text-sm sm:text-slate-500">
          {new Date(item.createdAt).toLocaleString()}
        </div>
      </div>

      <p className="mt-3 text-sm font-black text-blue-600 sm:mt-4">Open →</p>
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
        className={`mt-2 break-words text-2xl font-black leading-none sm:text-3xl ${
          alert ? "text-blue-700" : "text-slate-900"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}