import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Copy, Play, Repeat2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import TrainerLayout from "../components/TrainerLayout";
import PageHeader from "../components/ui/PageHeader";
import { btnPrimary, card } from "../components/ui/styles";
import {
  SESSION_SOURCE,
  createSession,
  loadLatestSessionForClient,
  startOfWeek,
  type Session,
} from "../lib/sessions";

type ClientOption = {
  id: string;
  full_name: string;
  client_id: string | null;
};

type SessionListRow = {
  id: string;
  client_user_id: string;
  title: string | null;
  workout_date: string | null;
  status: "draft" | "completed" | null;
  updated_at: string | null;
};

export default function TrainerSessions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [trainerUserId, setTrainerUserId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sessions, setSessions] = useState<SessionListRow[]>([]);
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const [selectedClientId, setSelectedClientId] = useState(
    searchParams.get("client") || ""
  );
  const [title, setTitle] = useState("");
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [startMode, setStartMode] = useState<"copy" | "blank">("copy");
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!selectedClientId) return;

    let cancelled = false;
    loadLatestSessionForClient(selectedClientId).then((session) => {
      if (cancelled) return;
      setLastSession(session);
      setStartMode(session ? "copy" : "blank");
      if (session) setTitle((current) => current || session.title);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  async function loadPage() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatusMessage("You must be logged in as a trainer.");
      setIsLoading(false);
      return;
    }

    setTrainerUserId(user.id);

    const [clientsResult, sessionsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, client_id")
        .eq("role", "client")
        .order("full_name", { ascending: true }),
      supabase
        .from("client_historical_workouts")
        .select("id, client_user_id, title, workout_date, status, updated_at")
        .eq("source", SESSION_SOURCE)
        .order("workout_date", { ascending: false })
        .limit(40),
    ]);

    if (clientsResult.error) {
      setStatusMessage("Could not load clients: " + clientsResult.error.message);
    } else {
      setClients((clientsResult.data || []) as ClientOption[]);
    }

    if (sessionsResult.error) {
      setStatusMessage(
        "Could not load sessions: " +
          sessionsResult.error.message +
          ". Has the training sessions SQL been run in Supabase?"
      );
      setIsLoading(false);
      return;
    }

    const rows = (sessionsResult.data || []) as SessionListRow[];
    setSessions(rows);

    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      const { data: repeats } = await supabase
        .from("workout_submissions")
        .select("historical_workout_id")
        .in("historical_workout_id", ids)
        .gte("submitted_at", startOfWeek().toISOString());

      const counts: Record<string, number> = {};
      (repeats || []).forEach((row: { historical_workout_id: string | null }) => {
        if (!row.historical_workout_id) return;
        counts[row.historical_workout_id] = (counts[row.historical_workout_id] || 0) + 1;
      });
      setRepeatCounts(counts);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    loadPage();
  }, []);

  async function startSession() {
    if (!selectedClientId) {
      setStatusMessage("Choose a client first.");
      return;
    }

    setIsStarting(true);
    setStatusMessage("");

    const { sessionId, error } = await createSession({
      clientUserId: selectedClientId,
      trainerUserId,
      title: title.trim() || "Training session",
      copyFrom: startMode === "copy" ? lastSession : null,
    });

    setIsStarting(false);

    if (!sessionId) {
      setStatusMessage(error);
      return;
    }

    navigate(`/sessions/${sessionId}`);
  }

  function clientName(clientUserId: string) {
    return clients.find((client) => client.id === clientUserId)?.full_name || "Client";
  }

  const inProgress = useMemo(
    () => sessions.filter((session) => session.status === "draft"),
    [sessions]
  );
  const completed = useMemo(
    () => sessions.filter((session) => session.status !== "draft"),
    [sessions]
  );

  return (
    <TrainerLayout>
      <PageHeader
        eyebrow="In-person training"
        title="Sessions"
        description="Log your clients' sessions live instead of in your notes. Finished sessions appear in the client's app so they can repeat them during the week."
      />

      {statusMessage && (
        <p className="mb-4 rounded-2xl border border-line bg-white p-4 text-sm text-ink/80">
          {statusMessage}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <section className={`${card} flex-[1_1_320px] p-5`}>
          <h2 className="text-lg font-bold">Start a session</h2>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold">Client</span>
            <select
              value={selectedClientId}
              onChange={(event) => {
                setTitle("");
                setLastSession(null);
                setSelectedClientId(event.target.value);
              }}
              className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>
          </label>

          {selectedClientId && (
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-sm font-semibold">Start from</legend>
              <div className="grid gap-2">
                <StartOption
                  active={startMode === "copy"}
                  disabled={!lastSession}
                  onClick={() => setStartMode("copy")}
                  icon={<Copy className="h-4 w-4" />}
                  title="Last session"
                  detail={
                    lastSession
                      ? `${lastSession.title} · ${formatDate(lastSession.workoutDate)} · ${lastSession.exercises.length} exercises`
                      : "No previous session for this client yet"
                  }
                />
                <StartOption
                  active={startMode === "blank"}
                  onClick={() => setStartMode("blank")}
                  icon={<Play className="h-4 w-4" />}
                  title="Blank session"
                  detail="Add exercises as you go"
                />
              </div>
            </fieldset>
          )}

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold">Session name</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Upper body, Legs, Full body..."
              className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
            />
          </label>

          <button
            type="button"
            onClick={startSession}
            disabled={isStarting || !selectedClientId}
            className={`${btnPrimary} mt-5 w-full`}
          >
            <Play className="h-4 w-4 fill-current" />
            {isStarting ? "Starting..." : "Start session"}
          </button>
        </section>

        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
          {inProgress.length > 0 && (
            <section className={`${card} overflow-hidden`}>
              <h2 className="px-5 pb-3 pt-5 text-lg font-bold">In progress</h2>
              <ul>
                {inProgress.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    clientName={clientName(session.client_user_id)}
                    badge={
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Draft
                      </span>
                    }
                  />
                ))}
              </ul>
            </section>
          )}

          <section className={`${card} overflow-hidden`}>
            <h2 className="px-5 pb-3 pt-5 text-lg font-bold">Recent sessions</h2>
            {isLoading ? (
              <p className="border-t border-line px-5 py-8 text-sm text-muted">
                Loading sessions...
              </p>
            ) : completed.length === 0 ? (
              <p className="border-t border-line px-5 py-8 text-sm text-muted">
                No sessions yet. Start one on the left.
              </p>
            ) : (
              <ul>
                {completed.map((session) => {
                  const repeats = repeatCounts[session.id] || 0;
                  return (
                    <SessionRow
                      key={session.id}
                      session={session}
                      clientName={clientName(session.client_user_id)}
                      badge={
                        repeats > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <Repeat2 className="h-3.5 w-3.5" />
                            Repeated {repeats}× this week
                          </span>
                        ) : null
                      }
                    />
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">
        Old sessions from your notes can still be brought in with{" "}
        <Link to="/import-program" className="font-semibold text-accent hover:underline">
          Import notes
        </Link>
        .
      </p>
    </TrainerLayout>
  );
}

function StartOption({
  active,
  disabled = false,
  onClick,
  icon,
  title,
  detail,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? "border-accent bg-accent-soft" : "border-line bg-white hover:bg-canvas"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-accent text-white" : "bg-canvas text-muted"
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </button>
  );
}

function SessionRow({
  session,
  clientName,
  badge,
}: {
  session: SessionListRow;
  clientName: string;
  badge: ReactNode;
}) {
  return (
    <li className="border-t border-line">
      <Link
        to={`/sessions/${session.id}`}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition hover:bg-canvas"
      >
        <div className="min-w-[180px] flex-1">
          <p className="font-semibold">{clientName}</p>
          <p className="text-sm text-muted">
            {session.title || "Training session"} · {formatDate(session.workout_date)}
          </p>
        </div>
        {badge}
        <ChevronRight className="h-4 w-4 text-muted" />
      </Link>
    </li>
  );
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

