import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type SubmissionExercise = {
  id: string;
  exercise_name: string;
  planned_sets: string;
  planned_reps: string;
  planned_weight: string;
  planned_rest: string;
  completed: boolean;
  difficulty: string;
  notes: string;
};

type SubmittedWorkout = {
  id: string;
  workout_id: string | null;
  workout_title: string;
  submitted_at: string;
  notes: string;
  workout_submission_exercises: SubmissionExercise[];
};

export default function CompletedWorkout() {
  const { submissionId } = useParams();

  const [workout, setWorkout] = useState<SubmittedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);

  const userRole = localStorage.getItem("coachsync-user-role");

  const backToPlanLink =
    userRole === "trainer" ? "/workout-history" : "/client-plan";

  const dashboardLink = userRole === "trainer" ? "/trainer" : "/client";

  const backToPlanLabel =
    userRole === "trainer" ? "Back to Workout History" : "Back to My Plan";

  const dashboardLabel =
    userRole === "trainer" ? "Trainer Dashboard" : "Dashboard";

  useEffect(() => {
    loadWorkout();
  }, [submissionId]);

  async function loadWorkout() {
    setIsLoading(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!userError && user && userRole !== "trainer") {
      const { count: unreadCount, error: unreadError } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("client_user_id", user.id)
        .eq("receiver_user_id", user.id)
        .is("read_at", null);

      if (unreadError) {
        console.error(unreadError);
      } else {
        setUnreadMessages(unreadCount || 0);
      }
    }

    if (!submissionId) {
      setStatusMessage("No workout submission ID was found.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("workout_submissions")
      .select(
        `
        id,
        workout_id,
        workout_title,
        submitted_at,
        notes,
        workout_submission_exercises (
          id,
          exercise_name,
          planned_sets,
          planned_reps,
          planned_weight,
          planned_rest,
          completed,
          difficulty,
          notes
        )
      `
      )
      .eq("id", submissionId)
      .single();

    if (error || !data) {
      console.error(error);
      setStatusMessage(
        error?.message || "This completed workout could not be loaded."
      );
      setIsLoading(false);
      return;
    }

    setWorkout(data as SubmittedWorkout);
    setIsLoading(false);
  }

  if (isLoading) {
    const loadingContent = (
      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
          CoachSync
        </p>

        <h1 className="mt-3 text-2xl font-black text-slate-900">
          Loading completed workout...
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Pulling up your submitted workout details.
        </p>
      </section>
    );

    if (userRole === "trainer") {
      return (
        <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-8">
          <div className="mx-auto max-w-6xl">{loadingContent}</div>
        </main>
      );
    }

    return (
      <ClientLayout unreadMessages={unreadMessages}>
        {loadingContent}
      </ClientLayout>
    );
  }

  if (!workout) {
    const notFoundContent = (
      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
          CoachSync
        </p>

        <h1 className="mt-3 text-2xl font-black text-slate-900">
          Workout not found
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          This completed workout could not be loaded.
        </p>

        {statusMessage && (
          <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {statusMessage}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            to={backToPlanLink}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-blue-700"
          >
            {backToPlanLabel}
          </Link>

          <Link
            to={dashboardLink}
            className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-center text-sm font-black text-blue-600 hover:bg-sky-50"
          >
            {dashboardLabel}
          </Link>
        </div>
      </section>
    );

    if (userRole === "trainer") {
      return (
        <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-8">
          <div className="mx-auto max-w-6xl">{notFoundContent}</div>
        </main>
      );
    }

    return (
      <ClientLayout unreadMessages={unreadMessages}>
        {notFoundContent}
      </ClientLayout>
    );
  }

  const exercises = workout.workout_submission_exercises || [];

  const completedCount = exercises.filter(
    (exercise) => exercise.completed
  ).length;

  const totalExercises = exercises.length;

  const incompleteCount = totalExercises - completedCount;

  const completionPercent =
    totalExercises > 0
      ? Math.round((completedCount / totalExercises) * 100)
      : 0;

  const submittedDate = new Date(workout.submitted_at).toLocaleString();

  const submittedShortDate = new Date(
    workout.submitted_at
  ).toLocaleDateString();

  const pageContent = (
    <>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                Completed Workout
              </p>

              <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
                {workout.workout_title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
                Submitted: {submittedDate}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to={backToPlanLink}
                className="w-full rounded-2xl bg-white/15 px-4 py-3 text-center text-sm font-black text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto"
              >
                {backToPlanLabel}
              </Link>

              {userRole === "trainer" && (
                <Link
                  to={dashboardLink}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:w-auto"
                >
                  {dashboardLabel}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard
            title="Completed"
            value={`${completedCount} / ${totalExercises}`}
          />

          <SummaryCard title="Completion" value={`${completionPercent}%`} />

          <SummaryCard title="Incomplete" value={`${incompleteCount}`} />

          <SummaryCard title="Submitted" value={submittedShortDate} />
        </div>
      </section>

      {statusMessage && (
        <p className="mb-4 rounded-2xl border border-sky-100 bg-white p-4 text-sm font-semibold leading-6 text-slate-700 shadow-sm sm:mb-6">
          {statusMessage}
        </p>
      )}

      <section className="mb-4 rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Workout Completion
            </p>

            <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">
              {completedCount} / {totalExercises} exercises completed
            </h2>
          </div>

          <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 ring-1 ring-blue-100">
            {completionPercent}% complete
          </span>
        </div>

        <div className="mt-5 h-3 rounded-full bg-sky-50">
          <div
            className="h-3 rounded-full bg-blue-600 transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        {workout.notes && (
          <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-sm font-bold text-slate-500">Workout Notes</p>

            <p className="mt-1 whitespace-pre-wrap text-sm font-black leading-6 text-slate-800">
              {workout.notes}
            </p>
          </div>
        )}
      </section>

      {exercises.length === 0 ? (
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
          <h2 className="text-xl font-black text-slate-900">
            No exercise details found
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            This workout was submitted, but no exercise rows were saved.
          </p>
        </section>
      ) : (
        <section className="space-y-4 sm:space-y-6">
          {exercises.map((exercise, index) => (
            <div
              key={exercise.id}
              className={`rounded-[1.5rem] border p-4 shadow-sm sm:rounded-3xl sm:p-6 ${
                exercise.completed
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-red-100 bg-red-50"
              }`}
            >
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Exercise {index + 1}
                  </p>

                  <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">
                    {exercise.exercise_name}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {exercise.planned_sets || "N/A"} sets x{" "}
                    {exercise.planned_reps || "N/A"} reps • Weight:{" "}
                    {exercise.planned_weight || "N/A"} • Rest:{" "}
                    {exercise.planned_rest || "N/A"}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-3 py-1 text-sm font-black ring-1 ${
                    exercise.completed
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : "bg-red-100 text-red-700 ring-red-200"
                  }`}
                >
                  {exercise.completed ? "Completed" : "Not Completed"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoBox
                  label="Difficulty"
                  value={exercise.difficulty || "Not selected"}
                />

                <InfoBox label="Notes" value={exercise.notes || "No notes"} />
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );

  if (userRole === "trainer") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
        <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
          {pageContent}
        </section>
      </main>
    );
  }

  return (
    <ClientLayout unreadMessages={unreadMessages}>{pageContent}</ClientLayout>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2 className="mt-2 line-clamp-2 break-words text-xl font-black leading-tight text-slate-900 sm:text-2xl">
        {value}
      </h2>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>

      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-black leading-6 text-slate-900 sm:text-base">
        {value}
      </p>
    </div>
  );
}