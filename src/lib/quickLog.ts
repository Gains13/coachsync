import type { LoggedSet, SessionExercise } from "./sessions";

// Turns notes-app style lines into session exercises, for example:
//   Goblet squat 3x10 35
//   Bench 135x10, 155x8
//   Plank 3x30s
//   Warm up            (a section heading for the lines after it)

const MAX_SETS = 20;

const SECTION_HEADINGS: Record<string, string> = {
  warmup: "Warm-up",
  "warm up": "Warm-up",
  "warm-up": "Warm-up",
  activation: "Activation",
  "core activation": "Activation",
  core: "Activation",
  resistance: "Resistance",
  "resistance training": "Resistance",
  strength: "Resistance",
  lifts: "Resistance",
  conditioning: "Conditioning",
  cardio: "Conditioning",
  finisher: "Conditioning",
  cooldown: "Cool-down",
  "cool down": "Cool-down",
  "cool-down": "Cool-down",
};

const PAIR =
  /(\d+(?:\.\d+)?)\s*(lbs?|kgs?|#)?\s*[x×]\s*(\d+(?:\s*-\s*\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|reps?|each side|each leg|each arm|per side|per leg)?(?![a-z])/gi;

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

function repsLabel(amount: string, unit = "") {
  const value = amount.replace(/\s+/g, "");
  const lower = unit.toLowerCase();

  if (!lower || lower.startsWith("rep")) return value;
  if (lower.startsWith("s")) return `${value} sec`;
  if (lower.startsWith("m")) return `${value} min`;
  return `${value} ${lower}`;
}

function makeSets(count: number, weight: string, reps: string): LoggedSet[] {
  return Array.from({ length: Math.min(Math.max(count, 1), MAX_SETS) }, () => ({
    weight,
    reps,
    done: true,
  }));
}

function sectionHeading(line: string) {
  const cleaned = line.replace(/:\s*$/, "").trim();
  const known = SECTION_HEADINGS[cleaned.toLowerCase()];

  if (known) return known;
  return line.trim().endsWith(":") && cleaned ? cleaned : "";
}

function takeWeight(text: string) {
  const at = text.match(/@\s*(.+?)\s*$/);
  if (at) return { weight: at[1], text: text.slice(0, at.index) };

  const withUnit = text.match(/(\d+(?:\.\d+)?)\s*(lbs?|kgs?|#)(?![a-z])/i);
  if (withUnit) {
    return {
      weight: `${withUnit[1]} ${withUnit[2].toLowerCase()}`.replace(" #", " lb"),
      text: text.replace(withUnit[0], " "),
    };
  }

  const bodyweight = text.match(/\b(bw|bodyweight|body weight)\s*$/i);
  if (bodyweight) {
    return { weight: "Bodyweight", text: text.slice(0, bodyweight.index) };
  }

  return { weight: "", text };
}

export function parseQuickLine(input: string, section: string): SessionExercise | null {
  let text = input.replace(/^\s*(?:[-•*]\s*|\d+[.)]\s+)/, "").trim();
  if (!text) return null;

  let notes = "";
  text = text.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    notes = [notes, inner.trim()].filter(Boolean).join(" ");
    return " ";
  });

  let rest = "";
  text = text.replace(
    /\brest\s*:?\s*(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m)?(?![a-z])/i,
    (_, amount: string, unit = "") => {
      rest = unit.toLowerCase().startsWith("m") ? `${amount} min` : `${amount} sec`;
      return " ";
    }
  );

  const pairs = [...text.matchAll(PAIR)];
  pairs.forEach((pair) => {
    text = text.replace(pair[0], " ");
  });

  let sets: LoggedSet[] | null = null;
  let setCount = 1;
  let reps = "";
  let weight = "";

  if (pairs.length > 1) {
    // 135x10, 155x8: each pair is one set of weight x reps.
    sets = pairs.slice(0, MAX_SETS).map((pair) => ({
      weight: pair[2] ? `${pair[1]} ${pair[2].toLowerCase()}` : pair[1],
      reps: repsLabel(pair[3], pair[4]),
      done: true,
    }));
  } else if (pairs.length === 1) {
    const [, first, unit, second, secondUnit] = pairs[0];

    if (!unit && Number(first) <= 10 && Number.isInteger(Number(first))) {
      setCount = Number(first); // 3x10
    } else {
      weight = unit ? `${first} ${unit.toLowerCase()}` : first; // 135x10
    }

    reps = repsLabel(second, secondUnit);
  } else {
    text = text
      .replace(/(\d+)\s*sets?(?![a-z])/i, (_, amount: string) => {
        setCount = Number(amount);
        return " ";
      })
      .replace(/(\d+(?:\s*-\s*\d+)?)\s*reps?(?![a-z])/i, (_, amount: string) => {
        reps = repsLabel(amount);
        return " ";
      })
      .replace(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?)(?![a-z])/i,
        (match, amount: string, unit: string) => {
          if (reps) return match;
          reps = repsLabel(amount, unit);
          return " ";
        }
      );
  }

  if (!sets && !weight) {
    const taken = takeWeight(text);
    weight = taken.weight;
    text = taken.text;

    // A number left over next to sets x reps can only be the weight.
    if (!weight && pairs.length === 1) {
      const bare = text.match(/(\d+(?:\.\d+)?)\s*$/);
      if (bare) {
        weight = bare[1];
        text = text.slice(0, bare.index);
      }
    }
  }

  const exerciseName = text
    .replace(/\s+/g, " ")
    .replace(/\s+each$/i, "")
    .replace(/^[\s,:;–—-]+|[\s,:;@#×–—-]+$/g, "")
    .trim();

  return {
    key: newKey(),
    section,
    exerciseName: exerciseName || input.trim(),
    rest,
    notes,
    sets: sets || makeSets(setCount, weight, reps),
  };
}

export function parseQuickLog(text: string, startSection: string) {
  let section = startSection;
  const exercises: SessionExercise[] = [];

  text.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;

    const heading = sectionHeading(line);
    if (heading) {
      section = heading;
      return;
    }

    const exercise = parseQuickLine(line, section);
    if (exercise) exercises.push(exercise);
  });

  return { exercises, section };
}

export function describeSets(sets: LoggedSet[]) {
  const label = (set: LoggedSet) =>
    [set.weight, set.reps].filter(Boolean).join(" × ");
  const sameEverySet = sets.every(
    (set) => set.weight === sets[0].weight && set.reps === sets[0].reps
  );

  if (!sameEverySet) return sets.map(label).join(", ");

  const parts = [`${sets.length} ${sets.length === 1 ? "set" : "sets"}`];
  if (sets[0].reps) parts[0] = `${sets.length} × ${sets[0].reps}`;
  if (sets[0].weight) parts.push(`@ ${sets[0].weight}`);
  return parts.join(" ");
}
