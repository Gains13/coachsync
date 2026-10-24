import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import TrainerLayout from "../components/TrainerLayout";
import PageHeader from "../components/ui/PageHeader";
import { btnGhost } from "../components/ui/styles";

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type TemplateExercise = {
  id: string;
  exercise_name: string;
  sets: string | null;
  reps: string | null;
  weight: string | null;
  rest: string | null;
  video_link: string | null;
  exercise_order: number;
};

type TemplateWorkout = {
  id: string;
  title: string;
  workout_order: number;
  program_template_exercises: TemplateExercise[];
};

type ProgramTemplate = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  created_at: string;
  program_template_workouts: TemplateWorkout[];
};

type ExerciseForm = {
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  videoLink: string;
};

type WorkoutForm = {
  title: string;
  exercises: ExerciseForm[];
};

export default function Program() {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");

  const [assignClientIds, setAssignClientIds] = useState<Record<string, string>>(
    {}
  );

  const [assignWeekNumbers, setAssignWeekNumbers] = useState<
    Record<string, string>
  >({});

  const [isAssigningTemplateId, setIsAssigningTemplateId] = useState<
    string | null
  >(null);

  const [workouts, setWorkouts] = useState<WorkoutForm[]>([
    {
      title: "",
      exercises: [
        {
          exerciseName: "",
          sets: "",
          reps: "",
          weight: "",
          rest: "",
          videoLink: "",
        },
      ],
    },
  ]);

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
    setIsLoading(true);
    setStatusMessage("");

    await Promise.all([loadTemplates(), loadClients()]);

    setIsLoading(false);
  }

  async function loadTemplates() {
    const { data, error } = await supabase
      .from("program_templates")
      .select(
        `
        id,
        title,
        description,
        category,
        created_at,
        program_template_workouts (
          id,
          title,
          workout_order,
          program_template_exercises (
            id,
            exercise_name,
            sets,
            reps,
            weight,
            rest,
            video_link,
            exercise_order
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatusMessage("Could not load templates: " + error.message);
      return;
    }

    setTemplates(data || []);
  }

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

    setClients(data || []);
  }

  function updateWorkoutTitle(workoutIndex: number, value: string) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        return {
          ...workout,
          title: value,
        };
      })
    );
  }

  function addWorkout() {
    setWorkouts((currentWorkouts) => [
      ...currentWorkouts,
      {
        title: "",
        exercises: [
          {
            exerciseName: "",
            sets: "",
            reps: "",
            weight: "",
            rest: "",
            videoLink: "",
          },
        ],
      },
    ]);
  }

  function removeWorkout(workoutIndex: number) {
    if (workouts.length === 1) {
      setStatusMessage("You need at least one workout in the template.");
      return;
    }

    setWorkouts((currentWorkouts) =>
      currentWorkouts.filter((_, index) => index !== workoutIndex)
    );
  }

  function updateExercise(
    workoutIndex: number,
    exerciseIndex: number,
    field: keyof ExerciseForm,
    value: string
  ) {
    setWorkouts((currentWorkouts) =>
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

  function addExercise(workoutIndex: number) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        return {
          ...workout,
          exercises: [
            ...workout.exercises,
            {
              exerciseName: "",
              sets: "",
              reps: "",
              weight: "",
              rest: "",
              videoLink: "",
            },
          ],
        };
      })
    );
  }

  function removeExercise(workoutIndex: number, exerciseIndex: number) {
    setWorkouts((currentWorkouts) =>
      currentWorkouts.map((workout, index) => {
        if (index !== workoutIndex) return workout;

        if (workout.exercises.length === 1) {
          setStatusMessage("Each workout needs at least one exercise.");
          return workout;
        }

        return {
          ...workout,
          exercises: workout.exercises.filter(
            (_, currentExerciseIndex) => currentExerciseIndex !== exerciseIndex
          ),
        };
      })
    );
  }

  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault();

    if (!templateTitle.trim()) {
      setStatusMessage("Template title is required.");
      return;
    }

    const validWorkouts = workouts
      .map((workout) => ({
        ...workout,
        title: workout.title.trim(),
        exercises: workout.exercises.filter(
          (exercise) => exercise.exerciseName.trim() !== ""
        ),
      }))
      .filter((workout) => workout.title !== "" && workout.exercises.length > 0);

    if (validWorkouts.length === 0) {
      setStatusMessage("Add at least one workout with at least one exercise.");
      return;
    }

    setStatusMessage("Saving template...");

    const { data: templateData, error: templateError } = await supabase
      .from("program_templates")
      .insert({
        title: templateTitle.trim(),
        description: templateDescription.trim(),
        category: templateCategory.trim(),
      })
      .select()
      .single();

    if (templateError || !templateData) {
      console.error(templateError);
      setStatusMessage(templateError?.message || "Could not create template.");
      return;
    }

    for (
      let workoutIndex = 0;
      workoutIndex < validWorkouts.length;
      workoutIndex++
    ) {
      const workout = validWorkouts[workoutIndex];

      const { data: workoutData, error: workoutError } = await supabase
        .from("program_template_workouts")
        .insert({
          template_id: templateData.id,
          title: workout.title,
          workout_order: workoutIndex + 1,
        })
        .select()
        .single();

      if (workoutError || !workoutData) {
        console.error(workoutError);
        setStatusMessage(
          workoutError?.message ||
            `Could not create workout ${workoutIndex + 1}.`
        );
        return;
      }

      const exerciseRows = workout.exercises.map((exercise, exerciseIndex) => ({
        workout_id: workoutData.id,
        exercise_name: exercise.exerciseName.trim(),
        sets: exercise.sets.trim(),
        reps: exercise.reps.trim(),
        weight: exercise.weight.trim(),
        rest: exercise.rest.trim(),
        video_link: exercise.videoLink.trim(),
        exercise_order: exerciseIndex + 1,
      }));

      const { error: exerciseError } = await supabase
        .from("program_template_exercises")
        .insert(exerciseRows);

      if (exerciseError) {
        console.error(exerciseError);
        setStatusMessage(
          `Workout ${workout.title} was created, but exercises failed: ` +
            exerciseError.message
        );
        return;
      }
    }

    setTemplateTitle("");
    setTemplateDescription("");
    setTemplateCategory("");
    setWorkouts([
      {
        title: "",
        exercises: [
          {
            exerciseName: "",
            sets: "",
            reps: "",
            weight: "",
            rest: "",
            videoLink: "",
          },
        ],
      },
    ]);

    setStatusMessage("Template saved successfully.");
    await loadTemplates();
  }

  async function deleteTemplate(templateId: string, title: string) {
    const confirmed = window.confirm(
      `Delete template "${title}"? This removes all workouts and exercises inside it.`
    );

    if (!confirmed) return;

    setStatusMessage("Deleting template...");

    const { error } = await supabase
      .from("program_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      console.error(error);
      setStatusMessage("Could not delete template: " + error.message);
      return;
    }

    setStatusMessage("Template deleted.");
    await loadTemplates();
  }

  function updateAssignClient(templateId: string, clientId: string) {
    setAssignClientIds((current) => ({
      ...current,
      [templateId]: clientId,
    }));
  }

  function updateAssignWeek(templateId: string, weekNumber: string) {
    setAssignWeekNumbers((current) => ({
      ...current,
      [templateId]: weekNumber,
    }));
  }

  async function assignTemplateToClient(template: ProgramTemplate) {
    const selectedClientId = assignClientIds[template.id];
    const weekNumber = assignWeekNumbers[template.id] || "1";

    if (!selectedClientId) {
      setStatusMessage("Choose a client before assigning the template.");
      return;
    }

    if (!weekNumber) {
      setStatusMessage("Choose a starting week number.");
      return;
    }

    if (template.program_template_workouts.length === 0) {
      setStatusMessage("This template has no workouts to assign.");
      return;
    }

    setIsAssigningTemplateId(template.id);
    setStatusMessage("Assigning template to client...");

    const { data: weekData, error: weekError } = await supabase
      .from("client_plan_weeks")
      .insert({
        client_user_id: selectedClientId,
        week_number: Number(weekNumber),
        status: "unlocked",
      })
      .select()
      .single();

    if (weekError || !weekData) {
      console.error(weekError);
      setStatusMessage(weekError?.message || "Could not create client week.");
      setIsAssigningTemplateId(null);
      return;
    }

    const sortedWorkouts = [...template.program_template_workouts].sort(
      (a, b) => a.workout_order - b.workout_order
    );

    for (let workoutIndex = 0; workoutIndex < sortedWorkouts.length; workoutIndex++) {
      const templateWorkout = sortedWorkouts[workoutIndex];

      const { data: workoutData, error: workoutError } = await supabase
        .from("client_plan_workouts")
        .insert({
          week_id: weekData.id,
          title: templateWorkout.title,
          workout_order: workoutIndex + 1,
        })
        .select()
        .single();

      if (workoutError || !workoutData) {
        console.error(workoutError);
        setStatusMessage(
          workoutError?.message ||
            `Could not assign workout ${workoutIndex + 1}.`
        );
        setIsAssigningTemplateId(null);
        return;
      }

      const sortedExercises = [
        ...templateWorkout.program_template_exercises,
      ].sort((a, b) => a.exercise_order - b.exercise_order);

      if (sortedExercises.length > 0) {
        const exerciseRows = sortedExercises.map((exercise, exerciseIndex) => ({
          workout_id: workoutData.id,
          exercise_name: exercise.exercise_name,
          sets: exercise.sets || "",
          reps: exercise.reps || "",
          weight: exercise.weight || "",
          rest: exercise.rest || "",
          video_link: exercise.video_link || "",
          exercise_order: exerciseIndex + 1,
        }));

        const { error: exerciseError } = await supabase
          .from("client_plan_exercises")
          .insert(exerciseRows);

        if (exerciseError) {
          console.error(exerciseError);
          setStatusMessage(
            `Workout ${templateWorkout.title} was assigned, but exercises failed: ` +
              exerciseError.message
          );
          setIsAssigningTemplateId(null);
          return;
        }
      }
    }

    const assignedClient = clients.find((client) => client.id === selectedClientId);

    setStatusMessage(
      `Template assigned to ${assignedClient?.full_name || "client"} as Week ${weekNumber}.`
    );

    setAssignClientIds((current) => ({
      ...current,
      [template.id]: "",
    }));

    setAssignWeekNumbers((current) => ({
      ...current,
      [template.id]: "",
    }));

    setIsAssigningTemplateId(null);
  }

  return (
    <TrainerLayout>
        <PageHeader
          eyebrow="Program templates"
          title="Template library"
          description="Create reusable templates and assign them directly to a client’s active plan."
          actions={
            <button type="button" onClick={loadPageData} className={btnGhost}>
              Refresh
            </button>
          }
        />

        <div className="mb-4 grid grid-cols-3 gap-3">
          <SummaryCard title="Templates" value={`${templates.length}`} />
          <SummaryCard title="Clients" value={`${clients.length}`} />
          <SummaryCard title="Storage" value="Supabase" />
        </div>


        {statusMessage && (
          <p className="mb-6 rounded-2xl border border-line bg-white p-4 text-sm font-medium text-ink/80 ">
            {statusMessage}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={saveTemplate}
            className="rounded-[18px] border border-line bg-white p-6 "
          >
            <div className="mb-6">
              <h2 className="text-xl font-bold text-ink">
                Create New Template
              </h2>

              <p className="mt-1 text-sm text-muted">
                Build a reusable structure like Push/Pull/Legs, Golf Mobility,
                or Seated Strength.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Template Title"
                value={templateTitle}
                onChange={setTemplateTitle}
                placeholder="10-Week Push Pull Legs"
              />

              <Input
                label="Category"
                value={templateCategory}
                onChange={setTemplateCategory}
                placeholder="Strength / Golf / Mobility"
              />
            </div>

            <div className="mt-4">
              <TextArea
                label="Description"
                value={templateDescription}
                onChange={setTemplateDescription}
                placeholder="Who this template is for and how you would use it..."
              />
            </div>

            <div className="mt-8">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-ink">
                    Template Workouts
                  </h3>

                  <p className="mt-1 text-sm text-muted">
                    Add each workout/session inside this reusable template.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addWorkout}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
                >
                  Add Workout
                </button>
              </div>

              <div className="space-y-6">
                {workouts.map((workout, workoutIndex) => (
                  <div
                    key={workoutIndex}
                    className="rounded-[18px] border border-line bg-canvas p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <h4 className="font-bold text-ink">
                        Workout {workoutIndex + 1}
                      </h4>

                      <button
                        type="button"
                        onClick={() => removeWorkout(workoutIndex)}
                        className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                      >
                        Remove Workout
                      </button>
                    </div>

                    <Input
                      label="Workout Title"
                      value={workout.title}
                      onChange={(value) =>
                        updateWorkoutTitle(workoutIndex, value)
                      }
                      placeholder="Push Day"
                    />

                    <div className="mt-5">
                      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <h5 className="font-bold text-ink">Exercises</h5>

                        <button
                          type="button"
                          onClick={() => addExercise(workoutIndex)}
                          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-accent ring-1 ring-line hover:bg-accent-soft"
                        >
                          Add Exercise
                        </button>
                      </div>

                      <div className="space-y-4">
                        {workout.exercises.map((exercise, exerciseIndex) => (
                          <div
                            key={exerciseIndex}
                            className="rounded-2xl border border-line bg-white p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <h6 className="font-semibold text-ink">
                                Exercise {exerciseIndex + 1}
                              </h6>

                              <button
                                type="button"
                                onClick={() =>
                                  removeExercise(workoutIndex, exerciseIndex)
                                }
                                className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                              >
                                Remove
                              </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
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
                                placeholder="Bench Press"
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
                                placeholder="3"
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
                                placeholder="10"
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
                                placeholder="Trainer assigned"
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

                              <Input
                                label="Video Link"
                                value={exercise.videoLink}
                                onChange={(value) =>
                                  updateExercise(
                                    workoutIndex,
                                    exerciseIndex,
                                    "videoLink",
                                    value
                                  )
                                }
                                placeholder="https://youtube.com/..."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-2xl bg-accent px-5 py-4 font-semibold text-white hover:bg-accent-dark"
            >
              Save Template
            </button>
          </form>

          <div className="rounded-[18px] border border-line bg-white p-6 ">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-ink">
                Saved Templates
              </h2>

              <p className="mt-1 text-sm text-muted">
                Assign a saved template to a client’s visible plan.
              </p>
            </div>

            {isLoading ? (
              <p className="rounded-2xl bg-canvas p-5 text-muted">
                Loading templates...
              </p>
            ) : templates.length === 0 ? (
              <p className="rounded-2xl bg-canvas p-5 text-muted">
                No templates saved yet.
              </p>
            ) : (
              <div className="space-y-5">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-[18px] border border-line bg-canvas p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-ink">
                          {template.title}
                        </h3>

                        <p className="mt-1 text-sm text-muted">
                          {template.category || "No category"}
                        </p>

                        {template.description && (
                          <p className="mt-2 text-sm text-muted">
                            {template.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deleteTemplate(template.id, template.title)
                        }
                        className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mb-5 rounded-2xl border border-line bg-white p-4">
                      <h4 className="mb-3 font-semibold text-ink">
                        Assign Template to Client
                      </h4>

                      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-ink/80">
                            Client
                          </label>

                          <select
                            value={assignClientIds[template.id] || ""}
                            onChange={(event) =>
                              updateAssignClient(
                                template.id,
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-line"
                          >
                            <option value="">Choose client</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.full_name} — {client.client_id}
                              </option>
                            ))}
                          </select>
                        </div>

                        <Input
                          label="Week"
                          value={assignWeekNumbers[template.id] || ""}
                          onChange={(value) =>
                            updateAssignWeek(template.id, value)
                          }
                          placeholder="1"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => assignTemplateToClient(template)}
                        disabled={isAssigningTemplateId === template.id}
                        className="mt-4 w-full rounded-2xl bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isAssigningTemplateId === template.id
                          ? "Assigning..."
                          : "Assign Template to Client"}
                      </button>
                    </div>

                    <div className="space-y-4">
                      {[...template.program_template_workouts]
                        .sort((a, b) => a.workout_order - b.workout_order)
                        .map((workout) => (
                          <div
                            key={workout.id}
                            className="rounded-2xl border border-line bg-white p-4"
                          >
                            <h4 className="font-semibold text-ink">
                              {workout.title}
                            </h4>

                            <div className="mt-3 space-y-2">
                              {[...workout.program_template_exercises]
                                .sort(
                                  (a, b) =>
                                    a.exercise_order - b.exercise_order
                                )
                                .map((exercise) => (
                                  <div
                                    key={exercise.id}
                                    className="rounded-xl bg-canvas p-3"
                                  >
                                    <p className="font-semibold text-ink">
                                      {exercise.exercise_name}
                                    </p>

                                    <p className="mt-1 text-sm text-muted">
                                      {exercise.sets || "—"} sets x{" "}
                                      {exercise.reps || "—"} reps • Weight:{" "}
                                      {exercise.weight || "N/A"} • Rest:{" "}
                                      {exercise.rest || "N/A"}
                                    </p>

                                    {exercise.video_link && (
                                      <a
                                        href={exercise.video_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 inline-block text-sm font-semibold text-accent hover:text-accent"
                                      >
                                        Video Link
                                      </a>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </TrainerLayout>
  );
}


function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-ink/80">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none ring-0 placeholder:text-muted focus:border-accent/40 focus:ring-2 focus:ring-line"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-ink/80">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none ring-0 placeholder:text-muted focus:border-accent/40 focus:ring-2 focus:ring-line"
      />
    </div>
  );
}
function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-white p-4 sm:p-5">
      <p className="text-sm text-muted">{title}</p>

      <h2 className="mt-1 break-words text-xl font-bold text-ink">{value}</h2>
    </div>
  );
}
