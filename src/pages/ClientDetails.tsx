import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
  role: string;
  created_at: string;
};

type ClientAssessment = {
  starting_weight: string | null;
  body_fat: string | null;
  muscle_mass: string | null;
  waist: string | null;
  hips: string | null;
  chest: string | null;
  notes: string | null;
};

type ClientGoals = {
  main_goal: string | null;
  short_term_goal: string | null;
  long_term_goal: string | null;
  coach_notes: string | null;
};

type SubmittedWorkout = {
  id: string;
  workout_title: string;
  submitted_at: string;
};

type PlanExercise = {
  id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  video_link: string;
  exercise_order: number;
};

type PlanWorkout = {
  id: string;
  title: string;
  workout_order: number;
  client_plan_exercises: PlanExercise[];
};

type PlanWeek = {
  id: string;
  week_number: number;
  status: string;
  client_plan_workouts: PlanWorkout[];
};

type EditingWorkout = {
  id: string;
  title: string;
  workout_order: string;
};

type EditingExercise = {
  id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  video_link: string;
  exercise_order: string;
};

export default function ClientDetails() {
  const { clientUserId } = useParams();

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [assessment, setAssessment] = useState<ClientAssessment | null>(null);
  const [goals, setGoals] = useState<ClientGoals | null>(null);
  const [submittedWorkouts, setSubmittedWorkouts] = useState<
    SubmittedWorkout[]
  >([]);
  const [planWeeks, setPlanWeeks] = useState<PlanWeek[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [debugMessage, setDebugMessage] = useState("");

  const [editingWorkout, setEditingWorkout] =
    useState<EditingWorkout | null>(null);
  const [editingExercise, setEditingExercise] =
    useState<EditingExercise | null>(null);

  useEffect(() => {
    loadClientDetails();
  }, [clientUserId]);

  async function loadClientDetails() {
    setIsLoading(true);
    setStatusMessage("");
    setDebugMessage("");

    if (!clientUserId) {
      setDebugMessage("No clientUserId was found in the URL.");
      setIsLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, client_id, role, created_at")
      .eq("id", clientUserId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile load error:", profileError);
      setDebugMessage(profileError.message);
      setIsLoading(false);
      return;
    }

    if (!profileData) {
      setDebugMessage(
        `No profile found with id: ${clientUserId}. Check Supabase profiles table.`
      );
      setIsLoading(false);
      return;
    }

    const { data: assessmentData, error: assessmentError } = await supabase
      .from("client_assessments")
      .select(
        "starting_weight, body_fat, muscle_mass, waist, hips, chest, notes"
      )
      .eq("client_user_id", profileData.id)
      .maybeSingle();

    if (assessmentError) {
      console.error("Assessment load error:", assessmentError);
    }

    const { data: goalsData, error: goalsError } = await supabase
      .from("client_goals")
      .select("main_goal, short_term_goal, long_term_goal, coach_notes")
      .eq("client_user_id", profileData.id)
      .maybeSingle();

    if (goalsError) {
      console.error("Goals load error:", goalsError);
    }

    const { data: workoutsData, error: workoutsError } = await supabase
      .from("workout_submissions")
      .select("id, workout_title, submitted_at")
      .eq("client_user_id", profileData.id)
      .order("submitted_at", { ascending: false });

    if (workoutsError) {
      console.error("Workout submissions load error:", workoutsError);
    }

    const { data: planData, error: planError } = await supabase
      .from("client_plan_weeks")
      .select(
        `
        id,
        week_number,
        status,
        client_plan_workouts (
          id,
          title,
          workout_order,
          client_plan_exercises (
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
      .eq("client_user_id", profileData.id)
      .order("week_number", { ascending: true });

    if (planError) {
      console.error("Plan load error:", planError);
    }

    setProfile(profileData);
    setAssessment(assessmentData || null);
    setGoals(goalsData || null);
    setSubmittedWorkouts(workoutsData || []);
    setPlanWeeks(planData || []);
    setEditingWorkout(null);
    setEditingExercise(null);
    setIsLoading(false);
  }

  async function updateWeekStatus(weekId: string, newStatus: string) {
    setStatusMessage("Updating week status...");

    const { error } = await supabase
      .from("client_plan_weeks")
      .update({ status: newStatus })
      .eq("id", weekId);

    if (error) {
      console.error(error);
      setStatusMessage("Could not update week: " + error.message);
      return;
    }

    setStatusMessage("Week status updated.");
    await loadClientDetails();
  }

  function startEditingWorkout(workout: PlanWorkout) {
    setEditingWorkout({
      id: workout.id,
      title: workout.title,
      workout_order: String(workout.workout_order),
    });

    setEditingExercise(null);
  }

  async function saveWorkoutEdit() {
    if (!editingWorkout) return;

    if (!editingWorkout.title.trim()) {
      setStatusMessage("Workout title cannot be empty.");
      return;
    }

    setStatusMessage("Saving workout...");

    const { error } = await supabase
      .from("client_plan_workouts")
      .update({
        title: editingWorkout.title.trim(),
        workout_order: Number(editingWorkout.workout_order) || 1,
      })
      .eq("id", editingWorkout.id);

    if (error) {
      console.error(error);
      setStatusMessage("Could not update workout: " + error.message);
      return;
    }

    setStatusMessage("Workout updated.");
    await loadClientDetails();
  }

  function startEditingExercise(exercise: PlanExercise) {
    setEditingExercise({
      id: exercise.id,
      exercise_name: exercise.exercise_name,
      sets: exercise.sets,
      reps: exercise.reps,
      weight: exercise.weight,
      rest: exercise.rest,
      video_link: exercise.video_link,
      exercise_order: String(exercise.exercise_order),
    });

    setEditingWorkout(null);
  }

  async function saveExerciseEdit() {
    if (!editingExercise) return;

    if (!editingExercise.exercise_name.trim()) {
      setStatusMessage("Exercise name cannot be empty.");
      return;
    }

    setStatusMessage("Saving exercise...");

    const { error } = await supabase
      .from("client_plan_exercises")
      .update({
        exercise_name: editingExercise.exercise_name.trim(),
        sets: editingExercise.sets.trim(),
        reps: editingExercise.reps.trim(),
        weight: editingExercise.weight.trim(),
        rest: editingExercise.rest.trim(),
        video_link: editingExercise.video_link.trim(),
        exercise_order: Number(editingExercise.exercise_order) || 1,
      })
      .eq("id", editingExercise.id);

    if (error) {
      console.error(error);
      setStatusMessage("Could not update exercise: " + error.message);
      return;
    }

    setStatusMessage("Exercise updated.");
    await loadClientDetails();
  }

  async function deleteWeek(weekId: string, weekNumber: number) {
    const confirmed = window.confirm(
      `Delete Week ${weekNumber}? This will also remove the workouts and exercises inside this week.`
    );

    if (!confirmed) return;

    setStatusMessage("Deleting week...");

    const { error } = await supabase
      .from("client_plan_weeks")
      .delete()
      .eq("id", weekId);

    if (error) {
      console.error(error);
      setStatusMessage("Could not delete week: " + error.message);
      return;
    }

    setStatusMessage("Week deleted.");
    await loadClientDetails();
  }

  async function deleteWorkout(workoutId: string, workoutTitle: string) {
    const confirmed = window.confirm(
      `Delete workout "${workoutTitle}"? This will also remove the exercises inside this workout.`
    );

    if (!confirmed) return;

    setStatusMessage("Deleting workout...");

    const { error } = await supabase
      .from("client_plan_workouts")
      .delete()
      .eq("id", workoutId);

    if (error) {
      console.error(error);
      setStatusMessage("Could not delete workout: " + error.message);
      return;
    }

    setStatusMessage("Workout deleted.");
    await loadClientDetails();
  }

  async function deleteExercise(exerciseId: string, exerciseName: string) {
    const confirmed = window.confirm(`Delete exercise "${exerciseName}"?`);

    if (!confirmed) return;

    setStatusMessage("Deleting exercise...");

    const { error } = await supabase
      .from("client_plan_exercises")
      .delete()
      .eq("id", exerciseId);

    if (error) {
      console.error(error);
      setStatusMessage("Could not delete exercise: " + error.message);
      return;
    }

    setStatusMessage("Exercise deleted.");
    await loadClientDetails();
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            CoachSync
          </p>
          <h1 className="mt-3 text-2xl font-bold">Loading client...</h1>
          <p className="mt-2 text-slate-500">
            Pulling client details from Supabase.
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            CoachSync
          </p>
          <h1 className="mt-3 text-2xl font-bold">Client not found</h1>

          {debugMessage && (
            <p className="mt-4 rounded-2xl bg-sky-50 p-4 text-slate-600">
              {debugMessage}
            </p>
          )}

          <Link
            to="/clients"
            className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to Client List
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Client Details
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  {profile.full_name}
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Client ID: {profile.client_id}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/create-program"
                  className="rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Add Program
                </Link>

                <Link
                  to="/clients"
                  className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
                >
                  Back to Client List
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-4 md:p-8">
            <StatCard
              title="Submitted Workouts"
              value={`${submittedWorkouts.length}`}
            />

            <StatCard title="Assigned Weeks" value={`${planWeeks.length}`} />

            <StatCard
              title="Created"
              value={new Date(profile.created_at).toLocaleDateString()}
            />

            <StatCard title="Status" value="Active" />
          </div>
        </div>

        {statusMessage && (
          <p className="mb-6 rounded-2xl border border-sky-100 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
            {statusMessage}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Profile">
            <InfoRow label="Full Name" value={profile.full_name} />
            <InfoRow label="Client ID" value={profile.client_id || "Not set"} />
            <InfoRow label="Auth UID" value={profile.id} />
          </SectionCard>

          <SectionCard title="Goals">
            {goals ? (
              <div className="space-y-3">
                <InfoRow
                  label="Main Goal"
                  value={goals.main_goal || "Not set"}
                />

                <InfoRow
                  label="Short-Term Goal"
                  value={goals.short_term_goal || "Not set"}
                />

                <InfoRow
                  label="Long-Term Goal"
                  value={goals.long_term_goal || "Not set"}
                />

                <InfoRow
                  label="Coach Notes"
                  value={goals.coach_notes || "No notes"}
                />
              </div>
            ) : (
              <p className="text-slate-500">No goals added yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Starting Info">
            {assessment ? (
              <div className="grid gap-3 md:grid-cols-2">
                <InfoRow
                  label="Starting Weight"
                  value={assessment.starting_weight || "Not set"}
                />

                <InfoRow
                  label="Body Fat"
                  value={assessment.body_fat || "Not set"}
                />

                <InfoRow
                  label="Muscle Mass"
                  value={assessment.muscle_mass || "Not set"}
                />

                <InfoRow
                  label="Visceral Fat"
                  value={assessment.waist || "Not set"}
                />

                <InfoRow label="BMI" value={assessment.hips || "Not set"} />

                <div className="md:col-span-2">
                  <InfoRow label="Notes" value={assessment.notes || "No notes"} />
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No starting info added yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Submitted Workouts">
            {submittedWorkouts.length === 0 ? (
              <p className="text-slate-500">
                This client has not submitted any workouts yet.
              </p>
            ) : (
              <div className="space-y-3">
                {submittedWorkouts.map((workout) => (
                  <Link
                    key={workout.id}
                    to={`/workout-history/${workout.id}`}
                    className="block rounded-2xl border border-sky-100 bg-sky-50 p-4 hover:border-blue-200 hover:bg-blue-50"
                  >
                    <p className="font-semibold text-slate-900">
                      {workout.workout_title}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Submitted:{" "}
                      {new Date(workout.submitted_at).toLocaleString()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard title="Assigned Program">
            {planWeeks.length === 0 ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                <h3 className="font-semibold text-slate-900">
                  No assigned program yet
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Click Add Program to build this client’s first week.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {planWeeks.map((week) => (
                  <div
                    key={week.id}
                    className="rounded-3xl border border-sky-100 bg-sky-50 p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          Week {week.week_number}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Status: {week.status}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => updateWeekStatus(week.id, "locked")}
                          className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                        >
                          Lock
                        </button>

                        <button
                          onClick={() => updateWeekStatus(week.id, "unlocked")}
                          className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                        >
                          Unlock
                        </button>

                        <button
                          onClick={() => updateWeekStatus(week.id, "completed")}
                          className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
                        >
                          Mark Complete
                        </button>

                        <button
                          onClick={() => deleteWeek(week.id, week.week_number)}
                          className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Delete Week
                        </button>
                      </div>
                    </div>

                    {week.client_plan_workouts.length === 0 ? (
                      <p className="rounded-2xl bg-white p-4 text-slate-500">
                        No workouts added to this week.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {[...week.client_plan_workouts]
                          .sort((a, b) => a.workout_order - b.workout_order)
                          .map((workout) => (
                            <div
                              key={workout.id}
                              className="rounded-3xl border border-sky-100 bg-white p-5"
                            >
                              {editingWorkout?.id === workout.id ? (
                                <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                  <h4 className="mb-4 font-semibold text-blue-900">
                                    Edit Workout
                                  </h4>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <Input
                                      label="Workout Title"
                                      value={editingWorkout.title}
                                      onChange={(value) =>
                                        setEditingWorkout({
                                          ...editingWorkout,
                                          title: value,
                                        })
                                      }
                                      placeholder="Push Day"
                                    />

                                    <Input
                                      label="Workout Order"
                                      value={editingWorkout.workout_order}
                                      onChange={(value) =>
                                        setEditingWorkout({
                                          ...editingWorkout,
                                          workout_order: value,
                                        })
                                      }
                                      placeholder="1"
                                      type="number"
                                    />
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={saveWorkoutEdit}
                                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                      Save Workout
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setEditingWorkout(null)}
                                      className="rounded-xl border border-sky-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-sky-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <h4 className="font-semibold text-slate-900">
                                      {workout.title}
                                    </h4>

                                    <p className="mt-1 text-xs text-slate-500">
                                      Order: {workout.workout_order}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() =>
                                        startEditingWorkout(workout)
                                      }
                                      className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                                    >
                                      Edit Workout
                                    </button>

                                    <button
                                      onClick={() =>
                                        deleteWorkout(workout.id, workout.title)
                                      }
                                      className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                                    >
                                      Delete Workout
                                    </button>
                                  </div>
                                </div>
                              )}

                              {workout.client_plan_exercises.length === 0 ? (
                                <p className="rounded-2xl bg-sky-50 p-3 text-sm text-slate-500">
                                  No exercises added to this workout.
                                </p>
                              ) : (
                                <div className="mt-3 space-y-3">
                                  {[...workout.client_plan_exercises]
                                    .sort(
                                      (a, b) =>
                                        a.exercise_order - b.exercise_order
                                    )
                                    .map((exercise) => (
                                      <div
                                        key={exercise.id}
                                        className="rounded-2xl border border-sky-100 bg-sky-50 p-4"
                                      >
                                        {editingExercise?.id ===
                                        exercise.id ? (
                                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                            <h5 className="mb-4 font-semibold text-blue-900">
                                              Edit Exercise
                                            </h5>

                                            <div className="grid gap-4 md:grid-cols-3">
                                              <Input
                                                label="Exercise Name"
                                                value={
                                                  editingExercise.exercise_name
                                                }
                                                onChange={(value) =>
                                                  setEditingExercise({
                                                    ...editingExercise,
                                                    exercise_name: value,
                                                  })
                                                }
                                                placeholder="Bench Press"
                                              />

                                              <Input
                                                label="Sets"
                                                value={editingExercise.sets}
                                                onChange={(value) =>
                                                  setEditingExercise({
                                                    ...editingExercise,
                                                    sets: value,
                                                  })
                                                }
                                                placeholder="3"
                                              />

                                              <Input
                                                label="Reps"
                                                value={editingExercise.reps}
                                                onChange={(value) =>
                                                  setEditingExercise({
                                                    ...editingExercise,
                                                    reps: value,
                                                  })
                                                }
                                                placeholder="10"
                                              />

                                              <Input
                                                label="Weight"
                                                value={editingExercise.weight}
                                                onChange={(value) =>
                                                  setEditingExercise({
                                                    ...editingExercise,
                                                    weight: value,
                                                  })
                                                }
                                                placeholder="95 lbs"
                                              />

                                              <Input
                                                label="Rest"
                                                value={editingExercise.rest}
                                                onChange={(value) =>
                                                  setEditingExercise({
                                                    ...editingExercise,
                                                    rest: value,
                                                  })
                                                }
                                                placeholder="60 seconds"
                                              />

                                              <Input
                                                label="Order"
                                                value={
                                                  editingExercise.exercise_order
                                                }
                                                onChange={(value) =>
                                                  setEditingExercise({
                                                    ...editingExercise,
                                                    exercise_order: value,
                                                  })
                                                }
                                                placeholder="1"
                                                type="number"
                                              />

                                              <div className="md:col-span-3">
                                                <Input
                                                  label="Video Link"
                                                  value={
                                                    editingExercise.video_link
                                                  }
                                                  onChange={(value) =>
                                                    setEditingExercise({
                                                      ...editingExercise,
                                                      video_link: value,
                                                    })
                                                  }
                                                  placeholder="https://youtube.com/..."
                                                />
                                              </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                              <button
                                                type="button"
                                                onClick={saveExerciseEdit}
                                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                              >
                                                Save Exercise
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setEditingExercise(null)
                                                }
                                                className="rounded-xl border border-sky-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-sky-50"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                              <p className="font-semibold text-slate-900">
                                                {exercise.exercise_name}
                                              </p>

                                              <p className="mt-1 text-sm text-slate-500">
                                                {exercise.sets} sets x{" "}
                                                {exercise.reps} reps • Weight:{" "}
                                                {exercise.weight || "N/A"} •
                                                Rest: {exercise.rest || "N/A"}
                                              </p>

                                              {exercise.video_link && (
                                                <a
                                                  href={exercise.video_link}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
                                                >
                                                  Video Link
                                                </a>
                                              )}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                              <button
                                                onClick={() =>
                                                  startEditingExercise(exercise)
                                                }
                                                className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                                              >
                                                Edit Exercise
                                              </button>

                                              <button
                                                onClick={() =>
                                                  deleteExercise(
                                                    exercise.id,
                                                    exercise.exercise_name
                                                  )
                                                }
                                                className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-100 hover:bg-red-100"
                                              >
                                                Delete Exercise
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>

      <h2 className="mt-2 break-words text-xl font-bold text-slate-900">
        {value}
      </h2>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-xl font-bold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
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