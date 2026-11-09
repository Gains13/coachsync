import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, RotateCcw, Timer, Volume2, VolumeX } from "lucide-react";

// Continuous hold timer for stretches and other timed holds. Runs every round
// (and both sides) back to back, with short switch/rest breaks between holds.

const MIN_HOLD = 30;
const HOLD_STEP = 15;
const GET_READY = 5;
const SWITCH_SIDES = 5;

type SegmentKind = "ready" | "hold" | "switch" | "rest";

type Segment = {
  kind: SegmentKind;
  seconds: number;
  round: number;
  side: "left" | "right" | null;
};

type HoldTimerProps = {
  exerciseName?: string;
  plannedReps?: string;
  plannedSets?: string;
  plannedRest?: string;
  onComplete?: () => void;
};

export function parseDurationSeconds(value: string | undefined) {
  if (!value) return 0;
  const lower = value.toLowerCase();

  const minutes = lower.match(/(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)\b/);
  if (minutes) return Math.round(Number(minutes[1]) * 60);

  const seconds = lower.match(/(\d+)\s*(s|sec|secs|second|seconds)\b/);
  if (seconds) return Number(seconds[1]);

  return 0;
}

const STRETCH_WORDS =
  /stretch|hold|mobility|pigeon|piriformis|figure.?4|90\/90|hip|hamstring|quad|glute|lunge|couch|child'?s pose|cat.?cow|plank|breath/i;
const SIDED_WORDS =
  /each side|per side|each leg|per leg|left|right|l\/r|single.?leg|pigeon|piriformis|figure.?4|90\/90|hip|lunge|couch|quad|hamstring/i;

// Show the timer for anything with a time target or that reads like a stretch.
export function shouldOfferHoldTimer(
  exerciseName = "",
  plannedReps = "",
  section = ""
) {
  return (
    parseDurationSeconds(plannedReps) > 0 ||
    STRETCH_WORDS.test(exerciseName) ||
    /cool|stretch|mobility|recovery/i.test(section)
  );
}

function buildSegments(
  holdSeconds: number,
  rounds: number,
  eachSide: boolean,
  restSeconds: number
): Segment[] {
  const segments: Segment[] = [{ kind: "ready", seconds: GET_READY, round: 1, side: null }];
  const sides: ("left" | "right" | null)[] = eachSide ? ["left", "right"] : [null];

  for (let round = 1; round <= rounds; round += 1) {
    sides.forEach((side, sideIndex) => {
      if (sideIndex > 0) {
        segments.push({ kind: "switch", seconds: SWITCH_SIDES, round, side });
      }
      segments.push({ kind: "hold", seconds: holdSeconds, round, side });
    });

    if (round < rounds && restSeconds > 0) {
      segments.push({ kind: "rest", seconds: restSeconds, round: round + 1, side: sides[0] });
    }
  }

  return segments;
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sideLabel(side: Segment["side"]) {
  if (side === "left") return "Left side";
  if (side === "right") return "Right side";
  return "";
}

export default function HoldTimer({
  exerciseName = "",
  plannedReps = "",
  plannedSets = "",
  plannedRest = "",
  onComplete,
}: HoldTimerProps) {
  const [holdSeconds, setHoldSeconds] = useState(() =>
    Math.max(MIN_HOLD, parseDurationSeconds(plannedReps) || MIN_HOLD)
  );
  const [rounds, setRounds] = useState(() =>
    Math.min(10, Math.max(1, Number.parseInt(plannedSets, 10) || 2))
  );
  const [eachSide, setEachSide] = useState(() => SIDED_WORDS.test(exerciseName));
  const [restSeconds] = useState(() => {
    const parsed = parseDurationSeconds(plannedRest) || Number.parseInt(plannedRest, 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 120) : 10;
  });
  const [soundOn, setSoundOn] = useState(true);

  const [index, setIndex] = useState(-1); // -1 = not started
  const [remainingMs, setRemainingMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const endsAtRef = useRef(0);
  // Always call the latest onComplete, even from a long-running interval.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });
  const lastCueRef = useRef("");
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const segments = useMemo(
    () => buildSegments(holdSeconds, rounds, eachSide, restSeconds),
    [holdSeconds, rounds, eachSide, restSeconds]
  );

  const totalSeconds = segments.reduce((sum, segment) => sum + segment.seconds, 0);
  const segment = index >= 0 ? segments[index] : null;
  const remaining = Math.ceil(remainingMs / 1000);

  function beep(frequency = 880, duration = 0.12) {
    if (!soundOn) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioRef.current) audioRef.current = new AudioCtx();
      const context = audioRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.15;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // Audio is a nice-to-have; ignore browsers that block it.
    }
  }

  function say(text: string) {
    if (!soundOn || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } catch {
      // Ignore speech failures.
    }
  }

  function cueFor(next: Segment) {
    if (next.kind === "hold") return next.side ? `Hold. ${sideLabel(next.side)}` : "Hold";
    if (next.kind === "switch") return "Switch sides";
    if (next.kind === "rest") return "Rest";
    return "Get ready";
  }

  async function keepScreenAwake(on: boolean) {
    try {
      if (on && !wakeLockRef.current && "wakeLock" in navigator) {
        wakeLockRef.current = await (
          navigator as unknown as {
            wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock.request("screen");
      } else if (!on && wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      wakeLockRef.current = null;
    }
  }

  function enterSegment(nextIndex: number) {
    const next = segments[nextIndex];
    endsAtRef.current = Date.now() + next.seconds * 1000;
    setIndex(nextIndex);
    setRemainingMs(next.seconds * 1000);
    lastCueRef.current = "";
    say(cueFor(next));
    navigator.vibrate?.(next.kind === "hold" ? [120, 80, 120] : 150);
  }

  function start() {
    setIsDone(false);
    setIsRunning(true);
    keepScreenAwake(true);
    enterSegment(0);
  }

  function pause() {
    setRemainingMs(Math.max(0, endsAtRef.current - Date.now()));
    setIsRunning(false);
    keepScreenAwake(false);
  }

  function resume() {
    endsAtRef.current = Date.now() + remainingMs;
    setIsRunning(true);
    keepScreenAwake(true);
  }

  function reset() {
    setIsRunning(false);
    setIsDone(false);
    setIndex(-1);
    setRemainingMs(0);
    keepScreenAwake(false);
    window.speechSynthesis?.cancel();
  }

  // Tick from the wall clock so the timer stays right if the tab sleeps.
  useEffect(() => {
    if (!isRunning || index < 0) return;

    const interval = window.setInterval(() => {
      const left = endsAtRef.current - Date.now();
      const secondsLeft = Math.ceil(left / 1000);
      const current = segments[index];

      if (current.kind === "hold" && secondsLeft <= 3 && secondsLeft > 0) {
        const cueKey = `${index}-${secondsLeft}`;
        if (lastCueRef.current !== cueKey) {
          lastCueRef.current = cueKey;
          beep(660);
        }
      }

      if (left > 0) {
        setRemainingMs(left);
        return;
      }

      if (index + 1 < segments.length) {
        enterSegment(index + 1);
        return;
      }

      window.clearInterval(interval);
      setRemainingMs(0);
      setIsRunning(false);
      setIsDone(true);
      keepScreenAwake(false);
      beep(990, 0.4);
      say("All done. Nice work.");
      navigator.vibrate?.([200, 100, 200, 100, 300]);
      onCompleteRef.current?.();
    }, 200);

    return () => window.clearInterval(interval);
  }, [isRunning, index, segments, soundOn]);

  // Re-acquire the wake lock when the user comes back to the tab.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && isRunning) keepScreenAwake(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isRunning]);

  useEffect(() => {
    return () => {
      wakeLockRef.current?.release().catch(() => undefined);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const started = index >= 0;
  const segmentSeconds = segment?.seconds || holdSeconds;
  const progress = started ? 1 - remainingMs / (segmentSeconds * 1000) : 0;
  const ringColor =
    segment?.kind === "hold"
      ? "stroke-accent"
      : segment?.kind === "rest" || segment?.kind === "switch"
        ? "stroke-amber-500"
        : "stroke-ink/40";

  const holdsDone = started
    ? segments.slice(0, index).filter((item) => item.kind === "hold").length
    : 0;
  const totalHolds = segments.filter((item) => item.kind === "hold").length;

  const phaseTitle = isDone
    ? "All done"
    : !segment
      ? "Continuous hold timer"
      : segment.kind === "hold"
        ? ["Hold", sideLabel(segment.side)].filter(Boolean).join(" · ")
        : segment.kind === "switch"
          ? `Switch to ${sideLabel(segment.side).toLowerCase()}`
          : segment.kind === "rest"
            ? "Rest"
            : "Get ready";

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      className="rounded-[18px] border border-line bg-white p-4 sm:p-5"
      aria-label="Hold timer"
    >
      <div className="flex items-center gap-2">
        <Timer className="h-5 w-5 text-accent" />
        <p className="flex-1 font-semibold">{phaseTitle}</p>
        <button
          type="button"
          onClick={() => setSoundOn((on) => !on)}
          aria-label={soundOn ? "Mute voice cues" : "Turn on voice cues"}
          aria-pressed={soundOn}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas"
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-5">
        <div className="relative h-32 w-32 shrink-0" aria-live="polite">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-canvas" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))}
              className={`${ringColor} transition-[stroke-dashoffset] duration-200`}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold tabular-nums">
              {formatClock(started ? remaining : holdSeconds)}
            </span>
            {segment && !isDone && (
              <span className="text-xs text-muted">
                Round {segment.round} of {rounds}
              </span>
            )}
          </span>
        </div>

        <div className="min-w-[180px] flex-1">
          {!started || isDone ? (
            <div className="grid gap-3">
              <Stepper
                label="Hold"
                value={formatClock(holdSeconds)}
                onDecrease={() => setHoldSeconds((value) => Math.max(MIN_HOLD, value - HOLD_STEP))}
                onIncrease={() => setHoldSeconds((value) => Math.min(600, value + HOLD_STEP))}
                decreaseDisabled={holdSeconds <= MIN_HOLD}
              />
              <Stepper
                label="Rounds"
                value={String(rounds)}
                onDecrease={() => setRounds((value) => Math.max(1, value - 1))}
                onIncrease={() => setRounds((value) => Math.min(10, value + 1))}
                decreaseDisabled={rounds <= 1}
              />
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={eachSide}
                  onChange={(event) => setEachSide(event.target.checked)}
                  className="h-5 w-5 accent-[var(--color-accent)]"
                />
                Each side (left, then right)
              </label>
              <p className="text-xs text-muted">
                {totalHolds} hold{totalHolds === 1 ? "" : "s"} · about {formatClock(totalSeconds)} total
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {holdsDone} of {totalHolds} holds done
              {segment?.kind !== "hold" && segments[index + 1]
                ? ` · next: ${sideLabel(segments[index + 1].side) || "hold"}`
                : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {!started || isDone ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-white transition hover:bg-accent-dark"
          >
            <Play className="h-4 w-4 fill-current" />
            {isDone ? "Start again" : "Start timer"}
          </button>
        ) : isRunning ? (
          <button
            type="button"
            onClick={pause}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-5 font-semibold text-white transition hover:bg-ink/85"
          >
            <Pause className="h-4 w-4 fill-current" />
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={resume}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-white transition hover:bg-accent-dark"
          >
            <Play className="h-4 w-4 fill-current" />
            Resume
          </button>
        )}
        {started && (
          <button
            type="button"
            onClick={reset}
            aria-label="Reset timer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:bg-canvas"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-sm font-medium text-muted">{label}</span>
      <button
        type="button"
        onClick={onDecrease}
        disabled={decreaseDisabled}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[56px] text-center font-display text-lg font-bold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={`Increase ${label.toLowerCase()}`}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
