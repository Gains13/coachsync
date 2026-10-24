import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import TrainerLayout from "../components/TrainerLayout";
import { btnDanger, btnGhost, btnPrimary, card } from "../components/ui/styles";
import {
  SESSION_SECTIONS,
  deleteSession,
  emptySet,
  loadLatestSessionForClient,
  loadSession,
  newExercise,
  saveSession,
  type LoggedSet,
  type Session,
  type SessionExercise,
} from "../lib/sessions";

type SaveState = "saved" | "dirty" | "saving" | "error";

export default function TrainerSessionLog() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [clientName, setClientName] = useState("");
  const [previous, setPrevious] = useState<Session | null>(null);
  const [library, setLibrary] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);

  // Latest session for the debounced autosave, without re-running effects.
  const latest = useRef<Session | null>(null);
  const saving = useRef<Promise<void> | null>(null);

  useEffect(() => {
    loadPage();
  }, [sessionId]);

  async function loadPage() {
    const { session: loaded, error } = await loadSession(sessionId);

    if (!loaded) {
      setLoadError(error);
      return;
    }

    setSession(loaded);
    latest.current = loaded;

    const [{ data: profile }, { data: libraryRows }, prior] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", loaded.clientUserId).maybeSingle(),
      supabase.from("exercise_library").select("exercise_name").order("exercise_name"),
      loadLatestSessionForClient(loaded.clientUserId),
    ]);

    setClientName(profile?.full_name || "Client");
    setLibrary(
      Array.from(
        new Set(
          ((libraryRows || []) as { exercise_name: string }[])
            .map((row) => row.exercise_name)
            .filter(Boolean)
        )
      )
    );
    setPrevious(prior && prior.id !== loaded.id ? prior : null);
  }

  // Flush pending edits when leaving the page, and warn before closing the tab.
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (saveStateRef.current === "dirty" || saveStateRef.current === "saving") {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (saveStateRef.current === "dirty" && latest.current) {
        void saveSession(latest.current);
      }
    };
  }, []);

  // Debounced autosave: 1.2s after the last change.
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      persist();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [session, saveState]);

  async function persist(overrides: Partial<Session> = {}) {
    // Never run two saves at once: the exercise rows are rewritten each time.
    if (saving.current) await saving.current;
    if (!latest.current) return;

    const toSave = { ...latest.current, ...overrides };
    setSaveState("saving");

    const run = (async () => {
      const error = await saveSession(toSave);
      if (error) {
        setSaveError(error);
        setSaveState("error");
      } else {
        setSaveError("");
        setSaveState((state) => (state === "saving" ? "saved" : state));
      }
    })();

    saving.current = run;
    await run;
    saving.current = null;
  }

  function update(change: (current: Session) => Session) {
    setSession((current) => {
      if (!current) return current;
      const next = change(current);
      latest.current = next;
      return next;
    });
    setSaveState("dirty");
  }

  function updateExercise(key: string, change: (exercise: SessionExercise) => SessionExercise) {
    update((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.key === key ? change(exercise) : exercise
      ),
    }));
  }

  function updateSet(key: string, index: number, change: Partial<LoggedSet>) {
    updateExercise(key, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, setIndex) =>
        setIndex === index ? { ...set, ...change } : set
      ),
    }));
  }

  function moveExercise(index: number, direction: -1 | 1) {
    update((current) => {
      const exercises = [...current.exercises];
      const target = index + direction;
      if (target < 0 || target >= exercises.length) return current;
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...current, exercises };
    });
  }

  function addExercise() {
    update((current) => {
      const lastSection =
        current.exercises[current.exercises.length - 1]?.section || "Warm-up";
      return { ...current, exercises: [...current.exercises, newExercise(lastSection)] };
    });
  }

  async function finish() {
    if (!session) return;
    setIsFinishing(true);
    update((current) => ({ ...current, status: "completed" }));
    await persist({ status: "completed" });
    setIsFinishing(false);
    navigate("/sessions");
  }

  async function reopen() {
    update((current) => ({ ...current, status: "draft" }));
    await persist({ status: "draft" });
  }

  async function remove() {
    if (!session) return;
    if (!window.confirm("Delete this session? This can't be undone.")) return;
    if (saving.current) await saving.current;
    const error = await deleteSession(session.id);
    // Stop the leave-page flush from re-saving a deleted session.
    latest.current = null;
    saveStateRef.current = "saved";
    if (error) {
      setSaveError(error);
      setSaveState("error");
      return;
    }
    navigate("/sessions");
  }

  const previousByName = useMemo(() => {
    const map = new Map<string, SessionExercise>();
    previous?.exercises.forEach((exercise) => {
      map.set(exercise.exerciseName.trim().toLowerCase(), exercise);
    });
    return map;
  }, [previous]);

  if (loadError) {
    return (
      <TrainerLayout>
        <div className={`${card} p-6`}>
          <h1 className="text-xl font-bold">Session not available</h1>
          <p className="mt-2 text-sm text-muted">{loadError}</p>
          <Link to="/sessions" className={`${btnGhost} mt-4`}>
            Back to sessions
          </Link>
        </div>
      </TrainerLayout>
    );
  }

  if (!session) {
    return (
      <TrainerLayout>
        <p className={`${card} p-6 text-sm text-muted`}>Loading session...</p>
      </TrainerLayout>
    );
  }

  const isDraft = session.status === "draft";
  const doneSets = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.done).length,
    0
  );
  const totalSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return (
    <TrainerLayout>
      <datalist id="exercise-library">
        {library.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <header className="mb-4">
        <Link
          to="/sessions"
          className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Sessions
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
            {initials(clientName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{clientName}</p>
            <label className="block">
              <span className="sr-only">Session name</span>
              <input
                value={session.title}
                onChange={(event) =>
                  update((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Session name"
                className="w-full bg-transparent font-display text-2xl font-bold tracking-tight outline-none placeholder:text-muted sm:text-[28px]"
              />
            </label>
          </div>
          <SaveIndicator state={saveState} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted">Date</span>
            <input
              type="date"
              value={session.workoutDate.slice(0, 10)}
              onChange={(event) =>
                update((current) => ({ ...current, workoutDate: event.target.value }))
              }
              className="h-9 rounded-lg border border-line bg-white px-2"
            />
          </label>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isDraft ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isDraft ? "In progress · hidden from client" : "Finished · visible to client"}
          </span>
          <span className="text-muted">
            {doneSets} of {totalSets} sets done
          </span>
        </div>

        {saveError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Couldn't save: {saveError}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        {session.exercises.length === 0 && (
          <div className={`${card} p-6 text-center`}>
            <p className="font-semibold">No exercises yet</p>
            <p className="mt-1 text-sm text-muted">
              Add the first one and log sets as your client does them.
            </p>
          </div>
        )}

        {session.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.key}
            exercise={exercise}
            previous={previousByName.get(exercise.exerciseName.trim().toLowerCase())}
            isFirst={index === 0}
            isLast={index === session.exercises.length - 1}
            onMove={(direction) => moveExercise(index, direction)}
            onRemove={() =>
              update((current) => ({
                ...current,
                exercises: current.exercises.filter((item) => item.key !== exercise.key),
              }))
            }
            onChange={(change) => updateExercise(exercise.key, change)}
            onSetChange={(setIndex, change) => updateSet(exercise.key, setIndex, change)}
          />
        ))}

        <button
          type="button"
          onClick={addExercise}
          className="flex h-14 items-center justify-center gap-2 rounded-[18px] border border-dashed border-ink/25 bg-white font-semibold transition hover:bg-canvas"
        >
          <Plus className="h-5 w-5" />
          Add exercise
        </button>

        <label className={`${card} block p-4`}>
          <span className="mb-1.5 block text-sm font-semibold">Session notes</span>
          <textarea
            rows={3}
            value={session.notes}
            onChange={(event) =>
              update((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="How it went, what to change next time. Your client can see these."
            className="w-full resize-y rounded-xl border border-line px-3 py-2 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
          />
        </label>
      </div>

      <div className="sticky bottom-24 z-20 mt-4 flex flex-wrap gap-2 rounded-[18px] border border-line bg-white p-3 shadow-[0_8px_30px_rgba(15,20,25,0.08)] lg:bottom-4">
        <button type="button" onClick={remove} className={btnDanger}>
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
        <span className="flex-1" />
        {isDraft ? (
          <button
            type="button"
            onClick={finish}
            disabled={isFinishing}
            className={btnPrimary}
          >
            <Check className="h-4 w-4" />
            {isFinishing ? "Finishing..." : "Finish & share with client"}
          </button>
        ) : (
          <button type="button" onClick={reopen} className={btnGhost}>
            Hide from client
          </button>
        )}
      </div>
    </TrainerLayout>
  );
}

function ExerciseCard({
  exercise,
  previous,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onChange,
  onSetChange,
}: {
  exercise: SessionExercise;
  previous?: SessionExercise;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onChange: (change: (exercise: SessionExercise) => SessionExercise) => void;
  onSetChange: (index: number, change: Partial<LoggedSet>) => void;
}) {
  const sections = SESSION_SECTIONS.includes(exercise.section as (typeof SESSION_SECTIONS)[number])
    ? SESSION_SECTIONS
    : [...SESSION_SECTIONS, exercise.section];

  return (
    <section className={`${card} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={exercise.section}
          onChange={(event) => {
            const section = event.target.value;
            onChange((current) => ({ ...current, section }));
          }}
          aria-label="Section"
          className="h-9 rounded-full border border-line bg-canvas px-3 text-xs font-semibold"
        >
          {sections.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <IconButton label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
        </IconButton>
        <IconButton label="Move down" disabled={isLast} onClick={() => onMove(1)}>
          <ArrowDown className="h-4 w-4" />
        </IconButton>
        <IconButton label="Remove exercise" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      <label className="mt-2 block">
        <span className="sr-only">Exercise name</span>
        <input
          list="exercise-library"
          value={exercise.exerciseName}
          onChange={(event) => {
            const exerciseName = event.target.value;
            onChange((current) => ({ ...current, exerciseName }));
          }}
          placeholder="Exercise name"
          className="h-12 w-full rounded-xl border border-line px-3 text-base font-semibold outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
        />
      </label>

      {previous && (
        <p className="mt-2 text-sm text-muted">
          Last time:{" "}
          {previous.sets
            .map((set) => [set.weight, set.reps && `${set.reps} reps`].filter(Boolean).join(" × "))
            .filter(Boolean)
            .join(", ") || "no sets logged"}
        </p>
      )}

      <div className="mt-3 grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_48px_32px] items-center gap-2 text-xs font-semibold text-muted">
        <span>Set</span>
        <span>Weight</span>
        <span>Reps</span>
        <span className="text-center">Done</span>
        <span />
      </div>

      <div className="mt-1 flex flex-col gap-2">
        {exercise.sets.map((set, index) => (
          <div
            key={index}
            className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_48px_32px] items-center gap-2"
          >
            <span className="font-display text-lg font-bold">{index + 1}</span>
            <input
              value={set.weight}
              onChange={(event) => onSetChange(index, { weight: event.target.value })}
              placeholder="lbs"
              inputMode="decimal"
              aria-label={`Set ${index + 1} weight`}
              className="h-12 w-full rounded-xl border border-line px-2 text-center text-base font-semibold outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
            />
            <input
              value={set.reps}
              onChange={(event) => onSetChange(index, { reps: event.target.value })}
              placeholder="reps"
              inputMode="numeric"
              aria-label={`Set ${index + 1} reps`}
              className="h-12 w-full rounded-xl border border-line px-2 text-center text-base font-semibold outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
            />
            <button
              type="button"
              aria-pressed={set.done}
              aria-label={`Mark set ${index + 1} done`}
              onClick={() => onSetChange(index, { done: !set.done })}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border transition ${
                set.done
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-line bg-white text-muted hover:bg-canvas"
              }`}
            >
              <Check className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label={`Remove set ${index + 1}`}
              disabled={exercise.sets.length === 1}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  sets: current.sets.filter((_, setIndex) => setIndex !== index),
                }))
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas disabled:opacity-30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            onChange((current) => ({
              ...current,
              sets: [...current.sets, emptySet(current.sets[current.sets.length - 1])],
            }))
          }
          className={`${btnGhost} h-10`}
        >
          <Plus className="h-4 w-4" />
          Add set
        </button>
        <label className="flex flex-1 items-center gap-2">
          <span className="sr-only">Rest</span>
          <input
            value={exercise.rest}
            onChange={(event) => {
              const rest = event.target.value;
              onChange((current) => ({ ...current, rest }));
            }}
            placeholder="Rest (e.g. 60 sec)"
            className="h-10 w-full min-w-[120px] rounded-xl border border-line px-3 text-sm outline-none focus:border-accent/40"
          />
        </label>
      </div>

      <label className="mt-2 block">
        <span className="sr-only">Exercise notes</span>
        <input
          value={exercise.notes}
          onChange={(event) => {
            const notes = event.target.value;
            onChange((current) => ({ ...current, notes }));
          }}
          placeholder="Cues or notes for this exercise"
          className="h-10 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-accent/40"
        />
      </label>
    </section>
  );
}

function IconButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-canvas disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const label =
    state === "saving"
      ? "Saving..."
      : state === "dirty"
        ? "Unsaved changes"
        : state === "error"
          ? "Not saved"
          : "Saved";
  const color =
    state === "error" ? "bg-red-500" : state === "saved" ? "bg-emerald-500" : "bg-amber-500";

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "C";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
