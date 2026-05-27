import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type ParsedExercise = {
  formId: string;
  section: string;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  rawText: string;
};

type ParsedWorkout = {
  formId: string;
  title: string;
  workoutDate: string;
  originalDateLabel: string;
  exercises: ParsedExercise[];
};

const sectionNames = [
  "warmup",
  "warm up",
  "core activation",
  "core and activation",
  "activation",
  "balance",
  "saq",
  "resistance training",
  "resistance",
  "cool down",
  "cooldown",
];

const monthMap: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ImportProgram() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [importYear, setImportYear] = useState(String(new Date().getFullYear()));
  const [rawNotes, setRawNotes] = useState("");
  const [parsedWorkouts, setParsedWorkouts] = useState<ParsedWorkout[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, client_id")
      .eq("role", "client")
      .order("full_name", { ascending: true });

    if (error) {
      console.error(error);
      setStatusMessage("Could not load clients: " + error.message);
      return;
    }

    setClients((data || []) as ClientProfile[]);
  }

  function previewImport() {
    setStatusMessage("");

    if (!rawNotes.trim()) {
      setStatusMessage("Paste workout notes first.");
      return;
    }

    const parsed = parseWorkoutNotes(rawNotes, importYear);

    if (parsed.length === 0) {
      setStatusMessage(
        "No workouts were detected. Make sure each workout starts with a date like Feb 11th or March 4th."
      );
      return;
    }

    setParsedWorkouts(parsed);
    setStatusMessage(
      `Preview ready. Found ${parsed.length} workout${
        parsed.length === 1 ? "" : "s"
      }. Review them before saving.`
    );
  }

  function updateWorkout(
    workoutIndex: number,
    field: keyof ParsedWorkout,
    value: string
  ) {
    setParsedWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        return {
          ...workout,
          [field]: value,
        };
      })
    );
  }

  function removeWorkout(workoutIndex: number) {
    setParsedWorkouts((currentWorkouts) =>
      currentWorkouts.filter((_, index) => index !== workoutIndex)
    );
  }

  function updateExercise(
    workoutIndex: number,
    exerciseIndex: number,
    field: keyof ParsedExercise,
    value: string
  ) {
    setParsedWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, currentWorkoutIndex) => {
        if (currentWorkoutIndex !== workoutIndex) return workout;

        return {
          ...workout,
          exercises: workout.exercises.map((exercise, currentExerciseIndex) => {
            if (currentExerciseIndex !== exerciseIndex) return exercise;

            return {
              ...exercise,
              [field]: value,
            };
          }),
        };
      })
    );
  }

  function removeExercise(workoutIndex: number, exerciseIndex: number) {
    setParsedWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, currentWorkoutIndex) => {
        if (currentWorkoutIndex !== workoutIndex) return workout;

        return {
          ...workout,
          exercises: workout.exercises.filter(
            (_, currentExerciseIndex) => currentExerciseIndex !== exerciseIndex
          ),
        };
      })
    );
  }

  async function saveHistoricalWorkouts() {
    setStatusMessage("");

    if (!selectedClientId) {
      setStatusMessage("Select a client first.");
      return;
    }

    const validWorkouts = parsedWorkouts
      .map((workout) => ({
        ...workout,
        title: workout.title.trim(),
        workoutDate: workout.workoutDate.trim(),
        exercises: workout.exercises
          .map((exercise) => ({
            ...exercise,
            section: exercise.section.trim(),
            exerciseName: exercise.exerciseName.trim(),
            sets: exercise.sets.trim(),
            reps: exercise.reps.trim(),
            weight: exercise.weight.trim(),
            rest: exercise.rest.trim(),
            rawText: exercise.rawText.trim(),
          }))
          .filter((exercise) => exercise.exerciseName !== ""),
      }))
      .filter((workout) => workout.title !== "" && workout.exercises.length > 0);

    if (validWorkouts.length === 0) {
      setStatusMessage("Nothing valid to save. Check the preview first.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving historical workouts...");

    for (let workoutIndex = 0; workoutIndex < validWorkouts.length; workoutIndex++) {
      const workout = validWorkouts[workoutIndex];

      const { data: historicalWorkout, error: workoutError } = await supabase
        .from("client_historical_workouts")
        .insert({
          client_user_id: selectedClientId,
          title: workout.title,
          workout_date: workout.workoutDate || null,
          source: "notes_import",
          notes: `Imported from notes. Original date label: ${workout.originalDateLabel}`,
        })
        .select("id")
        .single();

      if (workoutError || !historicalWorkout) {
        console.error(workoutError);
        setStatusMessage(
          workoutError?.message ||
            `Could not save workout ${workoutIndex + 1}.`
        );
        setIsSaving(false);
        return;
      }

      const exerciseRows = workout.exercises.map((exercise, exerciseIndex) => ({
        historical_workout_id: historicalWorkout.id,
        section: exercise.section,
        exercise_name: exercise.exerciseName,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        rest: exercise.rest,
        raw_text: exercise.rawText,
        exercise_order: exerciseIndex + 1,
      }));

      const { error: exerciseError } = await supabase
        .from("client_historical_workout_exercises")
        .insert(exerciseRows);

      if (exerciseError) {
        console.error(exerciseError);
        setStatusMessage(
          `Workout "${workout.title}" was saved, but exercises failed: ` +
            exerciseError.message
        );
        setIsSaving(false);
        return;
      }
    }

    setStatusMessage(
      `Saved ${validWorkouts.length} historical workout${
        validWorkouts.length === 1 ? "" : "s"
      } successfully.`
    );

    setParsedWorkouts([]);
    setRawNotes("");
    setIsSaving(false);
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const totalExercises = useMemo(() => {
    return parsedWorkouts.reduce(
      (total, workout) => total + workout.exercises.length,
      0
    );
  }, [parsedWorkouts]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Notes Import
                </p>

                <h1 className="mt-3 break-words text-3xl font-bold md:text-4xl">
                  Import Historical Workouts
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Paste old workout notes, preview them, then save them to a
                  client’s past workout history and future copy library.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/create-program"
                  className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:py-2"
                >
                  Create Program
                </Link>

                <Link
                  to="/trainer"
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-4 md:p-8">
            <SummaryCard title="Client" value={selectedClient?.full_name || "Not selected"} />
            <SummaryCard title="Detected Workouts" value={`${parsedWorkouts.length}`} />
            <SummaryCard title="Detected Exercises" value={`${totalExercises}`} />
            <SummaryCard title="Source" value="Notes Import" />
          </div>
        </div>

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Client
              </label>

              <select
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} — {client.client_id}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Import Year"
              value={importYear}
              onChange={setImportYear}
              placeholder="2026"
              type="number"
            />
          </div>

          {selectedClient && (
            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <p className="text-sm font-medium text-slate-500">
                Selected Client
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                These workouts will be saved to {selectedClient.full_name}’s
                historical workout library.
              </p>
            </div>
          )}

          <div className="mt-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Paste Notes
            </label>

            <textarea
              value={rawNotes}
              onChange={(event) => setRawNotes(event.target.value)}
              placeholder="Paste your notes here. Example: Feb 11th&#10;Warm up&#10;10 minute treadmill..."
              rows={16}
              className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={previewImport}
              className="rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Preview Import
            </button>

            <button
              type="button"
              onClick={() => {
                setRawNotes("");
                setParsedWorkouts([]);
                setStatusMessage("");
              }}
              className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              Clear
            </button>
          </div>

          {statusMessage && (
            <p className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium leading-6 text-slate-700">
              {statusMessage}
            </p>
          )}
        </section>

        {parsedWorkouts.length > 0 && (
          <section className="mt-8 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Preview Imported Workouts
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Review and edit the parsed workouts before saving.
                </p>
              </div>

              <button
                type="button"
                onClick={saveHistoricalWorkouts}
                disabled={isSaving}
                className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Historical Workouts"}
              </button>
            </div>

            <div className="space-y-6">
              {parsedWorkouts.map((workout, workoutIndex) => (
                <div
                  key={workout.formId}
                  className="rounded-3xl border border-sky-100 bg-sky-50 p-4 sm:p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        {workout.originalDateLabel}
                      </p>

                      <h3 className="mt-1 text-lg font-bold text-slate-900">
                        Workout {workoutIndex + 1}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeWorkout(workoutIndex)}
                      className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
                    >
                      Remove Workout
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Workout Title"
                      value={workout.title}
                      onChange={(value) =>
                        updateWorkout(workoutIndex, "title", value)
                      }
                      placeholder="Feb 11th Session"
                    />

                    <Input
                      label="Workout Date"
                      value={workout.workoutDate}
                      onChange={(value) =>
                        updateWorkout(workoutIndex, "workoutDate", value)
                      }
                      placeholder="2026-02-11"
                      type="date"
                    />
                  </div>

                  <div className="mt-5 space-y-4">
                    {workout.exercises.map((exercise, exerciseIndex) => (
                      <div
                        key={exercise.formId}
                        className="rounded-2xl border border-sky-100 bg-white p-4"
                      >
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="font-semibold text-slate-900">
                            Exercise {exerciseIndex + 1}
                          </h4>

                          <button
                            type="button"
                            onClick={() =>
                              removeExercise(workoutIndex, exerciseIndex)
                            }
                            className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <Input
                            label="Section"
                            value={exercise.section}
                            onChange={(value) =>
                              updateExercise(
                                workoutIndex,
                                exerciseIndex,
                                "section",
                                value
                              )
                            }
                            placeholder="Warmup"
                          />

                          <Input
                            label="Exercise Name"
                            value={exercise.exerciseName}
                            onChange={(value) =>
                              updateExercise(
                                workoutIndex,
                                exerciseIndex,
                                "exerciseName",
                                value
                              )
                            }
                            placeholder="Chest Press"
                          />

                          <Input
                            label="Weight"
                            value={exercise.weight}
                            onChange={(value) =>
                              updateExercise(
                                workoutIndex,
                                exerciseIndex,
                                "weight",
                                value
                              )
                            }
                            placeholder="37.5lbs"
                          />

                          <Input
                            label="Sets"
                            value={exercise.sets}
                            onChange={(value) =>
                              updateExercise(
                                workoutIndex,
                                exerciseIndex,
                                "sets",
                                value
                              )
                            }
                            placeholder="2"
                          />

                          <Input
                            label="Reps"
                            value={exercise.reps}
                            onChange={(value) =>
                              updateExercise(
                                workoutIndex,
                                exerciseIndex,
                                "reps",
                                value
                              )
                            }
                            placeholder="10 - 12 reps"
                          />

                          <Input
                            label="Rest"
                            value={exercise.rest}
                            onChange={(value) =>
                              updateExercise(
                                workoutIndex,
                                exerciseIndex,
                                "rest",
                                value
                              )
                            }
                            placeholder="60 sec"
                          />
                        </div>

                        <div className="mt-4">
                          <Input
                            label="Original Line"
                            value={exercise.rawText}
                            onChange={(value) =>
                              updateExercise(
                                workoutIndex,
                                exerciseIndex,
                                "rawText",
                                value
                              )
                            }
                            placeholder="Original note line"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function parseWorkoutNotes(rawText: string, year: string): ParsedWorkout[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const workouts: ParsedWorkout[] = [];
  let currentWorkout: ParsedWorkout | null = null;
  let currentSection = "General";

  lines.forEach((line) => {
    const dateInfo = parseDateLine(line, year);

    if (dateInfo) {
      if (currentWorkout) {
        workouts.push(currentWorkout);
      }

      currentSection = "General";

      currentWorkout = {
        formId: makeId(),
        title: `${dateInfo.label} Session`,
        workoutDate: dateInfo.isoDate,
        originalDateLabel: dateInfo.label,
        exercises: [],
      };

      return;
    }

    if (!currentWorkout) {
      return;
    }

    if (isSectionLine(line)) {
      currentSection = normalizeSectionName(line);
      return;
    }

    const parsedExercise = parseExerciseLine(line, currentSection);
    currentWorkout.exercises.push(parsedExercise);
  });

  if (currentWorkout) {
    workouts.push(currentWorkout);
  }

  return workouts.filter((workout) => workout.exercises.length > 0);
}

function parseDateLine(line: string, year: string) {
  const cleaned = line
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/\b(\d{1,2})\s+(st|nd|rd|th)\b/gi, "$1")
    .trim();

  const monthFirstMatch = cleaned.match(
    /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:\s+\d{4})?$/i
  );

  const dayFirstMatch = cleaned.match(
    /^(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)(?:\s+\d{4})?$/i
  );

  let month = "";
  let day = "";

  if (monthFirstMatch) {
    month = monthFirstMatch[1].toLowerCase();
    day = monthFirstMatch[2];
  } else if (dayFirstMatch) {
    day = dayFirstMatch[1];
    month = dayFirstMatch[2].toLowerCase();
  } else {
    return null;
  }

  const monthNumber = monthMap[month];

  if (!monthNumber) return null;

  const dayNumber = day.padStart(2, "0");
  const isoDate = `${year}-${monthNumber}-${dayNumber}`;
  const label = line.trim();

  return {
    isoDate,
    label,
  };
}

function isSectionLine(line: string) {
  const normalized = line.toLowerCase().replace(/[:]/g, "").trim();

  return sectionNames.includes(normalized);
}

function normalizeSectionName(line: string) {
  const normalized = line.toLowerCase().replace(/[:]/g, "").trim();

  if (normalized === "warm up") return "Warmup";
  if (normalized === "warmup") return "Warmup";
  if (normalized === "core activation") return "Core Activation";
  if (normalized === "core and activation") return "Core Activation";
  if (normalized === "activation") return "Activation";
  if (normalized === "balance") return "Balance";
  if (normalized === "saq") return "SAQ";
  if (normalized === "resistance") return "Resistance Training";
  if (normalized === "resistance training") return "Resistance Training";
  if (normalized === "cooldown") return "Cooldown";
  if (normalized === "cool down") return "Cooldown";

  return line;
}

function parseExerciseLine(line: string, section: string): ParsedExercise {
  const weightMatch = line.match(/(\d+(?:\.\d+)?)\s?(lbs|lb|kg)\b/i);
  const setsMatch = line.match(/x\s?(\d+)/i);
  const repsMatch = line.match(/(\d+\s?(?:-\s?\d+)?\s?reps?)/i);
  const restMatch = line.match(/(\d+\s?(?:sec|seconds|min|minutes))/i);

  const rawExerciseName = line
    .replace(/^\s*(Hip Hinge|Squatting Motion|Pushing Motion|Pulling Motion|Pressing Motion):\s*/i, "")
    .replace(weightMatch?.[0] || "", "")
    .replace(setsMatch?.[0] || "", "")
    .replace(repsMatch?.[0] || "", "")
    .replace(restMatch?.[0] || "", "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    formId: makeId(),
    section,
    exerciseName: rawExerciseName || line,
    sets: setsMatch?.[1] || "",
    reps: repsMatch?.[1] || "",
    weight: weightMatch?.[0] || "",
    rest: restMatch?.[1] || "",
    rawText: line,
  };
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{title}</p>

      <h2 className="mt-2 break-words text-lg font-bold text-slate-900 sm:text-xl">
        {value}
      </h2>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}