import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Layers,
  Plus,
  RefreshCw,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import TrainerLayout from "../components/TrainerLayout";
import PageHeader from "../components/ui/PageHeader";
import { btnGhost, btnPrimary, card } from "../components/ui/styles";

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
  pain_reported?: boolean | null;
  pain_location?: string | null;
  pain_level?: number | null;
  pain_exercise?: string | null;
  pain_notes?: string | null;
  workout_submission_exercises: SubmissionExercise[];
};

type PersonalWorkoutLog = {
  id: string;
  client_user_id: string;
  activity_type: string | null;
  title: string | null;
  duration_minutes: number | null;
  location: string | null;
  intensity: string | null;
  notes: string | null;
  logged_at: string | null;
  created_at: string | null;
};

type ActivityItem = {
  id: string;
  type: "message" | "workout" | "note" | "personal" | "pain";
  title: string;
  description: string;
  clientUserId: string;
  clientName: string;
  createdAt: string;
  link: string;
  priority?: "high" | "normal";
};

export default function TrainerDashboard() {
  const displayName =
    localStorage.getItem("coachsync-display-name") || "Trainer";

  const [feedFilter, setFeedFilter] = useState<"all" | "pain" | "messages">(
    "all"
  );

  const [trainerUserId, setTrainerUserId] = useState("");
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [submissions, setSubmissions] = useState<WorkoutSubmission[]>([]);
  const [personalLogs, setPersonalLogs] = useState<PersonalWorkoutLog[]>([]);
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
        pain_reported,
        pain_location,
        pain_level,
        pain_exercise,
        pain_notes,
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
      .limit(30);

    if (submissionsError) {
      console.error(submissionsError);
      setStatusMessage(
        "Could not load workout activity: " + submissionsError.message
      );
    } else {
      setSubmissions((submissionsData || []) as WorkoutSubmission[]);
    }

    const { data: personalData, error: personalError } = await supabase
      .from("personal_workout_logs")
      .select(
        "id, client_user_id, activity_type, title, duration_minutes, location, intensity, notes, logged_at, created_at"
      )
      .order("logged_at", { ascending: false })
      .limit(20);

    if (personalError) {
      console.error(personalError);
      setStatusMessage(
        "Some activity loaded, but personal logs could not be loaded: " +
          personalError.message
      );
    } else {
      setPersonalLogs((personalData || []) as PersonalWorkoutLog[]);
    }

    const clientIds = Array.from(
      new Set([
        ...(messagesData || []).map((message) => message.client_user_id),
        ...(submissionsData || []).map(
          (submission) => submission.client_user_id
        ),
        ...(personalData || []).map((log) => log.client_user_id),
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

  function describePersonalLog(log: PersonalWorkoutLog) {
    const parts = [
      log.activity_type ? `Type: ${log.activity_type}` : "",
      log.duration_minutes ? `Duration: ${log.duration_minutes} min` : "",
      log.intensity ? `Intensity: ${log.intensity}` : "",
      log.location ? `Location: ${log.location}` : "",
      log.notes ? `Notes: ${log.notes}` : "",
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" • ") : "Personal activity logged.";
  }

  function describePainReport(submission: WorkoutSubmission) {
    const parts = [
      submission.pain_level ? `Level: ${submission.pain_level}/10` : "",
      submission.pain_location ? `Location: ${submission.pain_location}` : "",
      submission.pain_exercise ? `Exercise: ${submission.pain_exercise}` : "",
      submission.pain_notes ? `Notes: ${submission.pain_notes}` : "",
    ].filter(Boolean);

    return parts.length > 0
      ? parts.join(" • ")
      : "Pain or discomfort was reported.";
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

  const recentPersonalLogs = useMemo(() => {
    return personalLogs.slice(0, 5);
  }, [personalLogs]);

  const painReports = useMemo(() => {
    return submissions.filter((submission) => submission.pain_reported === true);
  }, [submissions]);

  const highPriorityPainReports = useMemo(() => {
    return painReports.filter(
      (submission) =>
        typeof submission.pain_level === "number" && submission.pain_level >= 7
    );
  }, [painReports]);

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
    const painActivities: ActivityItem[] = painReports.map((submission) => ({
      id: `pain-${submission.id}`,
      type: "pain",
      title: `${submission.pain_location || "Pain"} reported${
        submission.pain_level ? ` — ${submission.pain_level}/10` : ""
      }`,
      description: describePainReport(submission),
      clientUserId: submission.client_user_id,
      clientName: getClientName(submission.client_user_id),
      createdAt: submission.submitted_at,
      link: `/workout-history/${submission.id}`,
      priority:
        typeof submission.pain_level === "number" && submission.pain_level >= 7
          ? "high"
          : "normal",
    }));

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
        title: `${submission.workout_title || "Workout"} completed`,
        description: `${getCompletionPercent(submission)}% complete`,
        clientUserId: submission.client_user_id,
        clientName: getClientName(submission.client_user_id),
        createdAt: submission.submitted_at,
        link: `/workout-history/${submission.id}`,
      })
    );

    const personalActivities: ActivityItem[] = recentPersonalLogs.map((log) => ({
      id: `personal-${log.id}`,
      type: "personal",
      title: `${log.title || "Personal activity"} logged`,
      description: describePersonalLog(log),
      clientUserId: log.client_user_id,
      clientName: getClientName(log.client_user_id),
      createdAt: log.logged_at || log.created_at || new Date().toISOString(),
      link: `/clients/${log.client_user_id}`,
    }));

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

    return [
      ...painActivities,
      ...messageActivities,
      ...workoutActivities,
      ...personalActivities,
      ...noteActivities,
    ]
      .sort((a, b) => {
        if (a.type === "pain" && a.priority === "high") return -1;
        if (b.type === "pain" && b.priority === "high") return 1;

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
      .slice(0, 12);
  }, [
    painReports,
    unreadClientMessages,
    recentWorkoutSubmissions,
    recentPersonalLogs,
    exerciseNotes,
    clients,
    trainerUserId,
  ]);

  const notificationCount =
    unreadClientMessages.length +
    recentWorkoutSubmissions.length +
    exerciseNotes.length +
    recentPersonalLogs.length +
    painReports.length;

  const visibleActivity = activityItems.filter((item) => {
    if (feedFilter === "pain") return item.type === "pain";
    if (feedFilter === "messages") return item.type === "message";
    return true;
  });

  return (
    <TrainerLayout unreadMessages={unreadClientMessages.length}>
      <PageHeader
        eyebrow="Today"
        title={`Welcome, ${displayName}`}
        description={`${notificationCount} activity update${
          notificationCount === 1 ? "" : "s"
        } to review.`}
        actions={
          <>
            <Link to="/create-client" className={btnGhost}>
              Add client
            </Link>
            <Link to="/create-program" className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Create program
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3 lg:grid-cols-6">
        <SummaryCard
          title="Pain alerts"
          value={painReports.length}
          danger={painReports.length > 0}
        />
        <SummaryCard
          title="High pain"
          value={highPriorityPainReports.length}
          danger={highPriorityPainReports.length > 0}
        />
        <SummaryCard title="Messages" value={unreadClientMessages.length} />
        <SummaryCard title="Workouts" value={recentWorkoutSubmissions.length} />
        <SummaryCard title="Personal" value={recentPersonalLogs.length} />
        <SummaryCard title="Notes" value={exerciseNotes.length} />
      </div>

      {highPriorityPainReports.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {highPriorityPainReports.length} high-priority pain report
              {highPriorityPainReports.length === 1 ? "" : "s"} need review.
            </p>
            <p className="text-sm">These are reports marked 7/10 or higher.</p>
          </div>
        </div>
      )}

      {statusMessage && (
        <p className="mb-4 rounded-2xl border border-line bg-white p-4 text-sm leading-6 text-ink/80">
          {statusMessage}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <section className={`${card} min-w-0 flex-[999_1_520px] overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-5 sm:px-6">
            <h2 className="text-lg font-bold">Needs attention</h2>
            <div className="flex items-center gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["pain", "Pain"],
                  ["messages", "Messages"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={feedFilter === value}
                  onClick={() => setFeedFilter(value)}
                  className={`h-8 rounded-full border px-3 text-sm font-medium transition ${
                    feedFilter === value
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:bg-canvas"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={loadTrainerDashboardData}
                aria-label="Refresh activity"
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:bg-canvas"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isLoadingActivity ? (
            <p className="border-t border-line px-6 py-8 text-sm text-muted">
              Loading dashboard activity...
            </p>
          ) : visibleActivity.length === 0 ? (
            <div className="border-t border-line px-6 py-10 text-center">
              <h3 className="font-bold">Nothing here yet</h3>
              <p className="mt-1 text-sm text-muted">
                Pain reports, client messages, workout submissions, personal
                activity and exercise notes will appear here.
              </p>
            </div>
          ) : (
            <ul>
              {visibleActivity.map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  clientId={getClientId(item.clientUserId)}
                />
              ))}
            </ul>
          )}
        </section>

        <aside className={`${card} flex-[1_1_280px] p-5`}>
          <h2 className="text-lg font-bold">Quick actions</h2>
          <div className="mt-3 grid gap-2">
            <QuickLink to="/clients" icon={Users} label="View clients" />
            <QuickLink to="/create-program" icon={Layers} label="Create program" />
            <QuickLink to="/training-plans" icon={CalendarDays} label="Training plans" />
            <QuickLink to="/import-program" icon={Upload} label="Import notes" />
            <QuickLink to="/program" icon={BookOpen} label="Templates" />
          </div>
        </aside>
      </div>
    </TrainerLayout>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5 text-sm font-semibold transition hover:bg-accent-soft hover:text-accent"
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted" />
    </Link>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 0) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const typeStyles = {
  message: { label: "Message", pill: "bg-accent-soft text-accent" },
  workout: { label: "Workout", pill: "bg-emerald-50 text-emerald-700" },
  personal: { label: "Personal activity", pill: "bg-violet-50 text-violet-700" },
  note: { label: "Exercise note", pill: "bg-amber-50 text-amber-800" },
  pain: { label: "Pain report", pill: "bg-red-50 text-red-700" },
};

function ActivityRow({
  item,
  clientId,
}: {
  item: ActivityItem;
  clientId: string;
}) {
  const style = typeStyles[item.type];

  return (
    <li className="border-t border-line">
      <Link
        to={item.link}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 transition hover:bg-canvas sm:px-6"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
          {getInitials(item.clientName)}
        </span>

        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.clientName}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.pill}`}>
              {item.priority === "high" ? "High priority pain" : style.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-ink/80">{item.title}</p>
          <p className="line-clamp-2 text-sm text-muted">{item.description}</p>
          <p className="text-xs text-muted">Client ID: {clientId}</p>
        </div>

        <span className="text-sm text-muted">
          {new Date(item.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <span className="text-sm font-semibold text-accent">Open</span>
      </Link>
    </li>
  );
}

function SummaryCard({
  title,
  value,
  danger = false,
}: {
  title: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border p-3.5 sm:p-4 ${
        danger ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-white"
      }`}
    >
      <p className={`text-xs sm:text-sm ${danger ? "" : "text-muted"}`}>{title}</p>
      <p className="mt-1 font-display text-2xl font-bold leading-none sm:text-[30px]">
        {value}
      </p>
    </div>
  );
}
