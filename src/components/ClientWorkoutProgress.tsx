import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { trainerPost } from "../lib/trainerApi";
import { btnGhost, btnPrimary, card } from "./ui/styles";

type ProgressExercise = {
  exerciseId: string;
  name: string;
  section: string;
  completed: boolean;
  setsDone: number;
  totalSets: number;
  difficulty: string;
  notes: string;
};

type ProgressItem = {
  draftId: string;
  clientUserId: string;
  clientName: string;
  workoutId: string | null;
  historicalWorkoutId: string | null;
  title: string;
  updatedAt: string;
  painReported: boolean;
  workoutNotes: string;
  exercises: ProgressExercise[];
};

export type ChecklistExercise = {
  exerciseId: string;
  name: string;
  status?: string;
  finished?: boolean;
};

function hasStarted(item: ProgressItem) {
  return item.exercises.some((exercise) => exercise.setsDone > 0);
}

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function exerciseStatus(exercise: ProgressExercise) {
  if (exercise.completed) return "Done";
  if (exercise.setsDone > 0) return `${exercise.setsDone}/${exercise.totalSets} sets`;
  return "Not started";
}

export function MarkCompletePanel({
  clientUserId,
  workoutId,
  historicalWorkoutId,
  title,
  exercises,
  onCancel,
}: {
  clientUserId: string;
  workoutId?: string | null;
  historicalWorkoutId?: string | null;
  title: string;
  exercises: ChecklistExercise[];
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const hasProgress = exercises.some((exercise) => exercise.finished);

  function toggle(exerciseId: string) {
    setUnticked((current) => {
      const next = new Set(current);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  async function save() {
    setIsSaving(true);
    setError("");

    const { data, error: saveError } = await trainerPost<{
      submissionId?: string;
    }>("/api/trainer-complete-workout", {
      clientUserId,
      workoutId,
      historicalWorkoutId,
      incompleteExerciseIds: Array.from(unticked),
    });

    setIsSaving(false);

    if (saveError || !data?.submissionId) {
      setError(saveError || "The workout was not saved.");
      return;
    }

    navigate(`/workout-history/${data.submissionId}`);
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
      <h4 className="font-semibold text-ink">Mark "{title}" complete</h4>
      <p className="mt-1 text-sm leading-6 text-muted">
        This submits it for your client. Untick anything they didn't do.
      </p>

      {hasProgress && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-accent">
          <button type="button" onClick={() => setUnticked(new Set())}>
            Tick all
          </button>
          <button
            type="button"
            onClick={() =>
              setUnticked(
                new Set(
                  exercises
                    .filter((exercise) => !exercise.finished)
                    .map((exercise) => exercise.exerciseId)
                )
              )
            }
          >
            Only what they finished
          </button>
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {exercises.map((exercise) => (
          <li key={exercise.exerciseId}>
            <label className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={!unticked.has(exercise.exerciseId)}
                onChange={() => toggle(exercise.exerciseId)}
                className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="min-w-0 flex-1 break-words font-medium">
                {exercise.name}
              </span>
              {exercise.status && (
                <span className="shrink-0 text-xs font-semibold text-muted">
                  {exercise.status}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className={btnPrimary}
        >
          {isSaving ? "Saving..." : "Mark complete"}
        </button>
        <button type="button" onClick={onCancel} className={btnGhost}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ClientWorkoutProgress({
  clientUserId,
  showClientName = false,
  onlyStarted = false,
  limit,
  emptyText,
}: {
  clientUserId?: string;
  showClientName?: boolean;
  onlyStarted?: boolean;
  limit?: number;
  emptyText?: string;
}) {
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [markingId, setMarkingId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");

      const { data, error: loadError } = await trainerPost<{
        items?: ProgressItem[];
      }>("/api/client-workout-progress", clientUserId ? { clientUserId } : {});

      if (cancelled) return;

      setError(loadError);
      setItems(data?.items || []);
      setIsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [clientUserId]);

  const matching = onlyStarted ? items.filter(hasStarted) : items;
  const visible = limit ? matching.slice(0, limit) : matching;

  if (error) {
    return <p className="text-sm text-red-700">Could not load progress: {error}</p>;
  }

  if (isLoading) {
    return emptyText ? <p className="text-sm text-muted">Checking progress...</p> : null;
  }

  if (visible.length === 0) {
    return emptyText ? <p className="text-muted">{emptyText}</p> : null;
  }

  const list = (
    <ul className="space-y-3">
      {visible.map((item) => {
        const done = item.exercises.filter((exercise) => exercise.completed).length;
        const total = item.exercises.length;
        const isOpen = openId === item.draftId;
        const started = hasStarted(item);

        return (
          <li
            key={item.draftId}
            className="rounded-2xl border border-line bg-canvas p-4"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? "" : item.draftId)}
              aria-expanded={isOpen}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <span className="min-w-0">
                {showClientName && (
                  <span className="block text-sm font-bold text-accent">
                    {item.clientName}
                  </span>
                )}
                <span className="block break-words font-semibold text-ink">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-sm text-muted">
                  {started
                    ? `${done} of ${total} exercises done`
                    : "Opened, nothing done yet"}{" "}
                  · last active {timeAgo(item.updatedAt)}
                </span>
              </span>
              {isOpen ? (
                <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted" />
              ) : (
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted" />
              )}
            </button>

            <div className="mt-3 h-1.5 rounded-full bg-white">
              <div
                className="h-1.5 rounded-full bg-accent"
                style={{ width: `${Math.round((done / total) * 100)}%` }}
              />
            </div>

            {item.painReported && (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Pain noted during this workout
              </p>
            )}

            {isOpen && (
              <div className="mt-3 space-y-3">
                <ul className="divide-y divide-line rounded-xl border border-line bg-white">
                  {item.exercises.map((exercise) => (
                    <li key={exercise.exerciseId} className="px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 break-words font-medium">
                          {exercise.name}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            exercise.completed ? "text-emerald-700" : "text-muted"
                          }`}
                        >
                          {exerciseStatus(exercise)}
                        </span>
                      </div>
                      {(exercise.difficulty || exercise.notes) && (
                        <p className="mt-1 text-xs leading-5 text-muted">
                          {[exercise.difficulty, exercise.notes]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                {item.workoutNotes && (
                  <p className="text-sm leading-6 text-muted">
                    Client's notes: {item.workoutNotes}
                  </p>
                )}

                {markingId === item.draftId ? (
                  <MarkCompletePanel
                    clientUserId={item.clientUserId}
                    workoutId={item.workoutId}
                    historicalWorkoutId={item.historicalWorkoutId}
                    title={item.title}
                    exercises={item.exercises.map((exercise) => ({
                      exerciseId: exercise.exerciseId,
                      name: exercise.name,
                      status: exerciseStatus(exercise),
                      finished: exercise.completed,
                    }))}
                    onCancel={() => setMarkingId("")}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMarkingId(item.draftId)}
                      className={`${btnPrimary} h-10`}
                    >
                      Mark complete
                    </button>
                    {showClientName && (
                      <Link
                        to={`/clients/${item.clientUserId}`}
                        className={`${btnGhost} h-10`}
                      >
                        Open client
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return showClientName ? (
    <section className={`${card} mb-4 p-4 sm:p-6`}>
      <h2 className="mb-3 text-lg font-bold">Workouts in progress</h2>
      {list}
    </section>
  ) : (
    list
  );
}
