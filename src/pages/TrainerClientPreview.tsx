import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientDashboard from "./ClientDashboard";
import StartWorkout from "./StartWorkout";

type Profile = {
  id: string;
  full_name: string;
  client_id: string;
  setup_complete?: boolean | null;
  avatar_url?: string | null;
};

type TrainingPlan = {
  id: string;
  name: string;
  plan_type: "fixed" | "ongoing";
  planned_weeks: number | null;
  status: string;
};

type Exercise = {
  id: string;
  section?: string | null;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  video_link: string;
  exercise_order: number;
  trainer_notes?: string | null;
};

type Workout = {
  id: string;
  title: string;
  workout_order: number;
  client_plan_exercises: Exercise[];
};

type PlanWeek = {
  id: string;
  plan_id: string | null;
  week_number: number;
  status: string;
  client_plan_workouts: Workout[];
};

type SubmissionExercise = {
  id?: string;
  exercise_name?: string;
  name?: string;
  sets?: string | number | null;
  reps?: string | number | null;
  weight?: string | number | null;
  notes?: string | null;
  planned_sets?: string | null;
  planned_reps?: string | null;
  planned_weight?: string | null;
  planned_rest?: string | null;
  completed?: boolean;
  difficulty?: string | null;
};

type Submission = {
  id: string;
  workout_id?: string | null;
  workout_title?: string | null;
  title?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  date?: string | null;
  notes?: string | null;
  workout_submission_exercises?: SubmissionExercise[];
};

type MessageRow = {
  id: string;
  sender_user_id: string;
  receiver_user_id: string | null;
  message_body: string;
  created_at: string;
  read_at: string | null;
};

type PersonalLog = {
  id: string;
  activity_type: string | null;
  title: string | null;
  duration_minutes: number | null;
  intensity: string | null;
  location: string | null;
  notes: string | null;
  logged_at: string | null;
  created_at: string | null;
};

type HistoricalWorkout = {
  id: string;
  title: string;
  workout_date: string | null;
  source: string | null;
  notes: string | null;
};

const VIEWS = [
  ["", "Dashboard"],
  ["plan", "My Plan"],
  ["past-workouts", "Past Workouts"],
  ["messages", "Messages"],
  ["progress", "Progress"],
  ["settings", "Settings"],
] as const;

export default function TrainerClientPreview() {
  const params = useParams();
  const clientUserId = params.clientUserId || "";
  const splat = params["*"] || "";
  const parts = splat.split("/").filter(Boolean);
  const view = parts[0] || "";
  const detailId = parts[1] || "";
  const basePath = `/trainer/client-preview/${clientUserId}`;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [clientUserId]);

  async function loadProfile() {
    setLoadingProfile(true);
    if (!clientUserId) {
      setLoadingProfile(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, client_id, setup_complete, avatar_url")
      .eq("id", clientUserId)
      .maybeSingle();

    setProfile((data || null) as Profile | null);
    setLoadingProfile(false);
  }

  if (!clientUserId) {
    return <PreviewError message="No client ID was provided." />;
  }

  if (loadingProfile) {
    return <PreviewLoading />;
  }

  if (!profile) {
    return <PreviewError message="That client profile could not be found." />;
  }

  if (view === "") {
    return (
      <ClientDashboard
        previewClientUserId={clientUserId}
        previewMode
        previewBasePath={basePath}
      />
    );
  }

  return (
    <PreviewShell profile={profile} basePath={basePath} currentView={view}>
      {view === "plan" ? (
        <PlanPreview clientUserId={clientUserId} basePath={basePath} />
      ) : view === "past-workouts" ? (
        <PastWorkoutsPreview clientUserId={clientUserId} basePath={basePath} />
      ) : view === "messages" ? (
        <MessagesPreview clientUserId={clientUserId} />
      ) : view === "progress" ? (
        <ProgressPreview clientUserId={clientUserId} />
      ) : view === "settings" ? (
        <SettingsPreview profile={profile} />
      ) : view === "log-activity" ? (
        <LogActivityPreview />
      ) : view === "workout" && detailId ? (
        <StartWorkout
          previewMode
          previewWorkoutId={detailId}
          previewClientUserId={clientUserId}
          previewBasePath={basePath}
        />
      ) : view === "completed" && detailId ? (
        <CompletedPreview submissionId={detailId} basePath={basePath} />
      ) : (
        <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Preview page not found</h2>
          <p className="mt-2 text-sm text-slate-600">
            This preview route does not exist.
          </p>
        </div>
      )}
    </PreviewShell>
  );
}

function PreviewShell({
  profile,
  basePath,
  currentView,
  children,
}: {
  profile: Profile;
  basePath: string;
  currentView: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                Trainer Client Preview
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                Viewing {profile.full_name} • Read-only safety mode
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to={`/clients/${profile.id}`}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
              >
                Client Details
              </Link>
              <Link
                to="/clients"
                className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-black text-amber-800 hover:bg-amber-100"
              >
                Client List
              </Link>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {VIEWS.map(([slug, label]) => {
              const href = slug ? `${basePath}/${slug}` : basePath;
              const active = currentView === slug;
              return (
                <Link
                  key={slug || "dashboard"}
                  to={href}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black ${
                    active
                      ? "bg-amber-600 text-white"
                      : "border border-amber-200 bg-white text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          You can click through this preview. Submitting workouts, sending messages,
          changing passwords/settings, and logging activity are intentionally blocked.
        </div>
        {children}
      </div>
    </main>
  );
}

function PlanPreview({
  clientUserId,
  basePath,
}: {
  clientUserId: string;
  basePath: string;
}) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [clientUserId]);

  async function load() {
    setLoading(true);
    setError("");

    const { data: planData, error: planError } = await supabase
      .from("training_plans")
      .select("id, name, plan_type, planned_weeks, status")
      .eq("client_user_id", clientUserId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError) setError(planError.message);
    const active = (planData || null) as TrainingPlan | null;
    setPlan(active);

    let query = supabase
      .from("client_plan_weeks")
      .select(`
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
            exercise_order,
            trainer_notes
          )
        )
      `)
      .eq("client_user_id", clientUserId)
      .order("week_number", { ascending: true });

    if (active?.id) query = query.eq("plan_id", active.id);

    const { data: weekData, error: weekError } = await query;
    if (weekError) setError(weekError.message);
    setWeeks((weekData || []) as unknown as PlanWeek[]);

    const { data: submissions } = await supabase
      .from("workout_submissions")
      .select("workout_id")
      .eq("client_user_id", clientUserId);

    setCompletedIds(
      new Set(
        (submissions || [])
          .map((row: { workout_id: string | null }) => row.workout_id)
          .filter(Boolean) as string[]
      )
    );

    setLoading(false);
  }

  if (loading) return <LoadingCard text="Loading client plan..." />;

  return (
    <div className="space-y-5">
      <Hero title="My Plan" subtitle={plan ? `${plan.name}${plan.planned_weeks ? ` • ${plan.planned_weeks} weeks` : ""}` : "No active plan found"} />

      {error && <ErrorCard text={error} />}

      {weeks.length === 0 ? (
        <EmptyCard title="No assigned weeks" text="This is what the client would see when no weeks are attached to the active plan." />
      ) : (
        weeks.map((week) => (
          <section key={week.id} className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-600">Training Week</p>
                <h2 className="mt-1 text-2xl font-black">Week {week.week_number}</h2>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-sky-100">
                {week.status}
              </span>
            </div>

            <div className="space-y-4">
              {[...(week.client_plan_workouts || [])]
                .sort((a, b) => a.workout_order - b.workout_order)
                .map((workout) => {
                  const completed = completedIds.has(workout.id);
                  return (
                    <div key={workout.id} className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-black">{workout.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {workout.client_plan_exercises?.length || 0} exercises
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {completed && (
                            <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700">
                              Completed
                            </span>
                          )}
                          {week.status !== "locked" ? (
                            <Link
                              to={`${basePath}/workout/${workout.id}`}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100"
                            >
                              Preview Workout →
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2 text-sm font-black text-slate-500"
                            >
                              Preview Locked
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {[...(workout.client_plan_exercises || [])]
                          .sort((a, b) => a.exercise_order - b.exercise_order)
                          .map((exercise) => (
                            <div key={exercise.id} className="rounded-xl bg-white p-3 ring-1 ring-sky-100">
                              <p className="font-black">{exercise.exercise_name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {exercise.sets || "—"} sets • {exercise.reps || "—"} • {exercise.weight || "No weight"}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function PastWorkoutsPreview({
  clientUserId,
  basePath,
}: {
  clientUserId: string;
  basePath: string;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [logs, setLogs] = useState<PersonalLog[]>([]);
  const [historical, setHistorical] = useState<HistoricalWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [clientUserId]);

  async function load() {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from("workout_submissions").select("id, workout_id, workout_title, title, submitted_at, completed_at, date, notes").eq("client_user_id", clientUserId).order("submitted_at", { ascending: false }),
      supabase.from("personal_workout_logs").select("id, activity_type, title, duration_minutes, intensity, location, notes, logged_at, created_at").eq("client_user_id", clientUserId).order("logged_at", { ascending: false }),
      supabase.from("client_historical_workouts").select("id, title, workout_date, source, notes").eq("client_user_id", clientUserId).order("workout_date", { ascending: false }),
    ]);

    setSubmissions((a.data || []) as Submission[]);
    setLogs((b.data || []) as PersonalLog[]);
    setHistorical((c.data || []) as HistoricalWorkout[]);
    setLoading(false);
  }

  if (loading) return <LoadingCard text="Loading past workouts..." />;

  const items = [
    ...submissions.map((x) => ({ type: "Program", id: x.id, title: x.workout_title || x.title || "Workout", date: x.submitted_at || x.completed_at || x.date, link: `${basePath}/completed/${x.id}` })),
    ...logs.map((x) => ({ type: "Personal", id: x.id, title: x.title || x.activity_type || "Personal activity", date: x.logged_at || x.created_at, link: "" })),
    ...historical.map((x) => ({ type: "Imported", id: x.id, title: x.title, date: x.workout_date, link: "" })),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  return (
    <div className="space-y-5">
      <Hero title="Past Workouts" subtitle={`${items.length} recorded workout/activity items`} />
      {items.length === 0 ? (
        <EmptyCard title="No workout history" text="The client currently has no recorded past workouts." />
      ) : (
        <div className="grid gap-3">
          {items.map((item) =>
            item.link ? (
              <Link key={`${item.type}-${item.id}`} to={item.link} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm hover:border-blue-200">
                <HistoryRow item={item} />
              </Link>
            ) : (
              <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                <HistoryRow item={item} />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ item }: { item: { type: string; title: string; date: string | null | undefined } }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-blue-600">{item.type}</p>
        <h3 className="mt-1 font-black text-slate-900">{item.title}</h3>
      </div>
      <p className="text-sm font-semibold text-slate-500">{formatDate(item.date)}</p>
    </div>
  );
}

function MessagesPreview({ clientUserId }: { clientUserId: string }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [clientUserId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("id, sender_user_id, receiver_user_id, message_body, created_at, read_at")
      .eq("client_user_id", clientUserId)
      .order("created_at", { ascending: true });

    setMessages((data || []) as MessageRow[]);
    setLoading(false);
  }

  if (loading) return <LoadingCard text="Loading messages..." />;

  return (
    <div className="space-y-5">
      <Hero title="Messages" subtitle="Client conversation preview" />
      <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const fromClient = message.sender_user_id === clientUserId;
              return (
                <div key={message.id} className={`flex ${fromClient ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${fromClient ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900"}`}>
                    <p className="text-sm font-semibold">{message.message_body}</p>
                    <p className={`mt-1 text-[11px] ${fromClient ? "text-blue-100" : "text-slate-500"}`}>
                      {fromClient ? "Client" : "Trainer"} • {formatDateTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <label className="text-xs font-black uppercase tracking-wide text-amber-800">Message box disabled in preview</label>
          <textarea disabled placeholder="Sending is disabled while previewing a client." className="mt-2 min-h-24 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-500" />
        </div>
      </section>
    </div>
  );
}

function ProgressPreview({ clientUserId }: { clientUserId: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [clientUserId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("workout_submissions")
      .select("id, workout_title, submitted_at, workout_submission_exercises(*)")
      .eq("client_user_id", clientUserId)
      .order("submitted_at", { ascending: false });
    setSubmissions((data || []) as Submission[]);
    setLoading(false);
  }

  const exerciseRows = useMemo(() => {
    const map = new Map<string, { name: string; entries: number; bestWeight: number; totalVolume: number }>();

    submissions.forEach((submission) => {
      (submission.workout_submission_exercises || []).forEach((exercise) => {
        const name = exercise.exercise_name || exercise.name || "Unnamed Exercise";
        const weight = numberValue(exercise.weight ?? exercise.planned_weight);
        const sets = numberValue(exercise.sets ?? exercise.planned_sets);
        const reps = numberValue(exercise.reps ?? exercise.planned_reps);
        const volume = weight * sets * reps;
        const current = map.get(name) || { name, entries: 0, bestWeight: 0, totalVolume: 0 };
        map.set(name, {
          name,
          entries: current.entries + 1,
          bestWeight: Math.max(current.bestWeight, weight),
          totalVolume: current.totalVolume + volume,
        });
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [submissions]);

  if (loading) return <LoadingCard text="Loading progress..." />;

  return (
    <div className="space-y-5">
      <Hero title="Progress" subtitle={`${submissions.length} completed workouts • ${exerciseRows.length} tracked exercises`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Workouts" value={`${submissions.length}`} />
        <Stat label="Exercises" value={`${exerciseRows.length}`} />
        <Stat label="Total Entries" value={`${exerciseRows.reduce((sum, x) => sum + x.entries, 0)}`} />
      </div>

      <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Exercise Progress</h2>
        <div className="mt-4 space-y-3">
          {exerciseRows.length === 0 ? (
            <p className="text-sm text-slate-500">No progress data yet.</p>
          ) : (
            exerciseRows.map((row) => (
              <div key={row.name} className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{row.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.entries} logged entries</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-black text-blue-700">Best weight: {row.bestWeight || "—"}</p>
                    <p className="text-slate-500">Volume: {Math.round(row.totalVolume)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SettingsPreview({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-5">
      <Hero title="Account Settings" subtitle="Preview of the client account/settings area" />
      <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label="Name" value={profile.full_name} />
          <ReadOnlyField label="Client ID" value={profile.client_id || "Not set"} />
          <ReadOnlyField label="Setup Complete" value={profile.setup_complete === false ? "No" : "Yes"} />
          <ReadOnlyField label="Account User ID" value={profile.id} />
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-black text-amber-900">Password change disabled</h3>
          <p className="mt-1 text-sm text-amber-800">
            This preview will never call Supabase Auth updateUser or sign the trainer out.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input disabled type="password" placeholder="New password" className="rounded-xl border border-amber-200 bg-white p-3" />
            <input disabled type="password" placeholder="Confirm password" className="rounded-xl border border-amber-200 bg-white p-3" />
          </div>
          <button disabled className="mt-3 rounded-xl bg-slate-300 px-4 py-2 text-sm font-black text-slate-600">
            Save Changes (Disabled)
          </button>
        </div>
      </section>
    </div>
  );
}

function LogActivityPreview() {
  return (
    <div className="space-y-5">
      <Hero title="Log Activity" subtitle="Interactive form preview with saving disabled" />
      <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          {["Activity Type", "Title", "Duration (minutes)", "Location", "Intensity"].map((label) => (
            <label key={label} className="block">
              <span className="text-sm font-black text-slate-700">{label}</span>
              <input disabled placeholder={label} className="mt-2 w-full rounded-xl border border-sky-100 bg-slate-50 p-3 text-sm" />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="text-sm font-black text-slate-700">Notes</span>
            <textarea disabled className="mt-2 min-h-28 w-full rounded-xl border border-sky-100 bg-slate-50 p-3" />
          </label>
        </div>
        <button disabled className="mt-4 rounded-xl bg-slate-300 px-5 py-3 text-sm font-black text-slate-600">
          Log Activity (Disabled in Preview)
        </button>
      </section>
    </div>
  );
}

function CompletedPreview({
  submissionId,
  basePath,
}: {
  submissionId: string;
  basePath: string;
}) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [submissionId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("workout_submissions")
      .select(`
        id,
        workout_id,
        workout_title,
        title,
        submitted_at,
        completed_at,
        date,
        notes,
        workout_submission_exercises (*)
      `)
      .eq("id", submissionId)
      .single();

    setSubmission((data || null) as Submission | null);
    setLoading(false);
  }

  if (loading) return <LoadingCard text="Loading completed workout..." />;
  if (!submission) return <EmptyCard title="Completed workout not found" text="This workout submission could not be loaded." />;

  return (
    <div className="space-y-5">
      <Link to={`${basePath}/past-workouts`} className="text-sm font-black text-blue-700 hover:text-blue-800">← Back to Past Workouts</Link>
      <Hero
        title={submission.workout_title || submission.title || "Completed Workout"}
        subtitle={`Completed ${formatDate(submission.submitted_at || submission.completed_at || submission.date)}`}
      />

      <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
        {submission.notes && (
          <div className="mb-4 rounded-2xl bg-sky-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-blue-600">Workout Notes</p>
            <p className="mt-2 text-sm text-slate-700">{submission.notes}</p>
          </div>
        )}

        <div className="space-y-3">
          {(submission.workout_submission_exercises || []).map((exercise, index) => (
            <div key={exercise.id || `${index}`} className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <p className="font-black">{exercise.exercise_name || exercise.name || `Exercise ${index + 1}`}</p>
              <p className="mt-1 text-sm text-slate-500">
                Sets: {String(exercise.sets ?? exercise.planned_sets ?? "—")} •
                Reps: {String(exercise.reps ?? exercise.planned_reps ?? "—")} •
                Weight: {String(exercise.weight ?? exercise.planned_weight ?? "—")}
              </p>
              {exercise.notes && <p className="mt-2 text-sm text-slate-700">Notes: {exercise.notes}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-6 text-white sm:px-7 sm:py-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">CoachSync Client View</p>
        <h1 className="mt-2 text-3xl font-black">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-blue-50">{subtitle}</p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-sky-100 bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm">
      {text}
    </div>
  );
}

function ErrorCard({ text }: { text: string }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{text}</div>;
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function PreviewLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
      <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
        <p className="font-black">Loading client preview...</p>
      </div>
    </main>
  );
}

function PreviewError({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black">Client preview unavailable</h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        <Link to="/clients" className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">
          Back to Clients
        </Link>
      </div>
    </main>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleString();
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) || 0 : 0;
}