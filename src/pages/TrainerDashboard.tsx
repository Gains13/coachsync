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
              className="absolute inset-0 bg-slate-900/40"
            />

            <aside className="relative h-full w-72 border-r border-sky-100 bg-white shadow-xl">
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
          <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
            <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm"
              >
                ☰ Menu
              </button>

              <button
                onClick={logoutUser}
                className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Log out
              </button>
            </div>

            <div className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
              <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                      CoachSync Trainer Dashboard
                    </p>

                    <h1 className="mt-3 break-words text-3xl font-bold md:text-4xl">
                      Welcome, {displayName}
                    </h1>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                      Review important client activity first, then use the
                      sidebar to manage clients, programs, messages, and workout
                      history.
                    </p>
                  </div>

                  <button
                    onClick={logoutUser}
                    className="hidden rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2 lg:block"
                  >
                    Log out
                  </button>
                </div>
              </div>

              <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-4 md:p-8">
                <SummaryCard
                  title="Client Messages"
                  value={`${unreadClientMessages.length}`}
                  alert={unreadClientMessages.length > 0}
                />

                <SummaryCard
                  title="Recent Workouts"
                  value={`${recentWorkoutSubmissions.length}`}
                  alert={recentWorkoutSubmissions.length > 0}
                />

                <SummaryCard
                  title="Exercise Notes"
                  value={`${exerciseNotes.length}`}
                  alert={exerciseNotes.length > 0}
                />

                <SummaryCard
                  title="Notifications"
                  value={`${notificationCount}`}
                  alert={notificationCount > 0}
                />
              </div>
            </div>

            {statusMessage && (
              <p className="mb-6 rounded-2xl border border-sky-100 bg-white p-4 text-sm font-medium leading-6 text-slate-700 shadow-sm">
                {statusMessage}
              </p>
            )}

            <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
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
                  className="w-full rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:py-2"
                >
                  Refresh Activity
                </button>
              </div>

              {isLoadingActivity ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm font-medium text-slate-600">
                  Loading dashboard activity...
                </div>
              ) : activityItems.length === 0 ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                  <h3 className="font-bold text-slate-900">
                    No new activity yet
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Client messages, workout submissions, and exercise notes
                    will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {activityItems.map((item) => (
                    <ActivityCard
                      key={item.id}
                      item={item}
                      clientId={getClientId(item.clientUserId)}
                    />
                  ))}
                </div>
              )}
            </div>
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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">
            C
          </div>

          {sidebarOpen && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                CoachSync
              </p>

              <p className="truncate text-xs text-slate-500">
                Trainer Portal
              </p>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 lg:block"
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
          className={`flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 ${
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
      className={`group relative flex items-center gap-3 rounded-2xl border border-transparent p-3 text-sm font-semibold text-slate-700 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700 ${
        sidebarOpen ? "justify-start" : "justify-center"
      }`}
    >
      <span className="text-xl">{item.icon}</span>

      {sidebarOpen && <span className="min-w-0 flex-1 truncate">{item.title}</span>}

      {item.badge && item.badge > 0 ? (
        <span
          className={`rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white ${
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
      className="block rounded-3xl border border-sky-100 bg-sky-50 p-5 transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-sky-100">
              {style.icon}
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${style.badge}`}
            >
              {style.label}
            </span>
          </div>

          <h3 className="break-words text-lg font-bold text-slate-900">
            {item.title}
          </h3>

          <p className="mt-1 text-sm font-semibold text-slate-700">
            {item.clientName} • Client ID: {clientId}
          </p>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
            {item.description}
          </p>
        </div>

        <div className="shrink-0 text-sm text-slate-500">
          {new Date(item.createdAt).toLocaleString()}
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold text-blue-600">Open →</p>
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
      className={`rounded-2xl border p-4 sm:p-5 ${
        alert ? "border-blue-200 bg-blue-50" : "border-sky-100 bg-sky-50"
      }`}
    >
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{title}</p>

      <h2
        className={`mt-2 break-words text-lg font-bold sm:text-xl ${
          alert ? "text-blue-700" : "text-slate-900"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}