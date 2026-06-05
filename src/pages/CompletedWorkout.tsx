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
  client_user_id: string;
  workout_id: string | null;
  workout_title: string;
  submitted_at: string;
  notes: string | null;

  pain_reported: boolean | null;
  pain_location: string | null;
  pain_level: number | null;
  pain_exercise: string | null;
  pain_notes: string | null;

  workout_submission_exercises: SubmissionExercise[];
};

type ClientProfile = {
  id: string;
  full_name: string | null;
  client_id: string | null;
};

export default function CompletedWorkout() {
  const { submissionId } = useParams();

  const [workout, setWorkout] = useState<SubmittedWorkout | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(
    null
  );

  const [trainerUserId, setTrainerUserId] = useState("");
  const [trainerResponse, setTrainerResponse] = useState("");
  const [isSendingResponse, setIsSendingResponse] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
    setSuccessMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!userError && user) {
      if (userRole === "trainer") {
        setTrainerUserId(user.id);
      } else {
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
        client_user_id,
        workout_id,
        workout_title,
        submitted_at,
        notes,
        pain_reported,
        pain_location,
        pain_level,
        pain_exercise,
        pain_notes,
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

    const loadedWorkout = data as SubmittedWorkout;
    setWorkout(loadedWorkout);

    if (loadedWorkout.client_user_id) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, client_id")
        .eq("id", loadedWorkout.client_user_id)
        .maybeSingle();

      if (profileError) {
        console.error(profileError);
      } else if (profileData) {
        setClientProfile(profileData as ClientProfile);
      }
    }

    setIsLoading(false);
  }

  async function sendPainResponseToClient() {
    if (!workout) return;

    if (!trainerResponse.trim()) {
      setStatusMessage("Write a response before sending.");
      return;
    }

    if (!trainerUserId) {
      setStatusMessage("Trainer account could not be confirmed.");
      return;
    }

    setIsSendingResponse(true);
    setStatusMessage("");
    setSuccessMessage("");

    const clientName =
      clientProfile?.full_name || clientProfile?.client_id || "there";

    const messageBody = `Hi ${clientName},

I reviewed your pain report from "${workout.workout_title}".

Pain report:
- Location: ${workout.pain_location || "Not specified"}
- Level: ${
      typeof workout.pain_level === "number"
        ? `${workout.pain_level}/10`
        : "Not recorded"
    }
- Related exercise: ${workout.pain_exercise || "Not specified"}
- Notes: ${workout.pain_notes || "No notes added"}

Trainer response:
${trainerResponse.trim()}`;

    const { error } = await supabase.from("messages").insert({
      client_user_id: workout.client_user_id,
      sender_user_id: trainerUserId,
      receiver_user_id: workout.client_user_id,
      message_body: messageBody,
      read_at: null,
    });

    if (error) {
      console.error(error);
      setStatusMessage("Could not send response: " + error.message);
      setIsSendingResponse(false);
      return;
    }

    setTrainerResponse("");
    setSuccessMessage("Response sent to the client.");
    setIsSendingResponse(false);
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
          Pulling up the submitted workout details.
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

  const painReported = workout.pain_reported === true;

  const clientDisplayName =
    clientProfile?.full_name || clientProfile?.client_id || "Unknown Client";

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

              {userRole === "trainer" && (
                <p className="mt-1 text-sm font-bold text-blue-50">
                  Client: {clientDisplayName}
                </p>
              )}
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

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-5 md:p-8">
          <SummaryCard
            title="Completed"
            value={`${completedCount} / ${totalExercises}`}
          />

          <SummaryCard title="Completion" value={`${completionPercent}%`} />

          <SummaryCard title="Incomplete" value={`${incompleteCount}`} />

          <SummaryCard title="Submitted" value={submittedShortDate} />

          <SummaryCard
            title="Pain"
            value={painReported ? "Reported" : "None"}
            danger={painReported}
          />
        </div>
      </section>

      {statusMessage && (
        <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700 shadow-sm sm:mb-6">
          {statusMessage}
        </p>
      )}

      {successMessage && (
        <p className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black leading-6 text-emerald-700 shadow-sm sm:mb-6">
          {successMessage}
        </p>
      )}

      {painReported && (
        <section className="mb-4 rounded-[1.75rem] border border-red-100 bg-red-50 p-4 shadow-sm sm:mb-6 sm:rounded-3xl sm:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
                Pain & Discomfort Report
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                {typeof workout.pain_level === "number"
                  ? `${workout.pain_level}/10 pain level`
                  : "Pain level not recorded"}
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Review the client’s pain report and respond with next steps.
              </p>
            </div>

            {typeof workout.pain_level === "number" &&
              workout.pain_level >= 7 && (
                <span className="w-fit rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm">
                  High Priority
                </span>
              )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <PainBox
              label="Location"
              value={workout.pain_location || "Not specified"}
            />

            <PainBox
              label="Related Exercise"
              value={workout.pain_exercise || "Not specified"}
            />

            <PainBox
              label="Pain Level"
              value={
                typeof workout.pain_level === "number"
                  ? `${workout.pain_level}/10`
                  : "Not recorded"
              }
            />
          </div>

          <div className="mt-4 rounded-2xl border border-red-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-red-600">
              Client Pain Notes
            </p>

            <p className="mt-2 whitespace-pre-wrap break-words text-sm font-black leading-6 text-slate-900">
              {workout.pain_notes || "No pain notes added."}
            </p>
          </div>

          {userRole === "trainer" && (
            <div className="mt-5 rounded-2xl border border-red-100 bg-white p-4">
              <label className="block text-sm font-black text-slate-800">
                Respond to Pain Report
              </label>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                This sends a message directly to the client.
              </p>

              <textarea
                value={trainerResponse}
                onChange={(event) => setTrainerResponse(event.target.value)}
                disabled={isSendingResponse}
                rows={5}
                placeholder="Example: Thanks for letting me know. For now, avoid that movement, keep the intensity low, and I’ll adjust your next workout."
                className="mt-3 w-full rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={sendPainResponseToClient}
                disabled={isSendingResponse}
                className="mt-3 w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSendingResponse
                  ? "Sending Response..."
                  : "Send Response to Client"}
              </button>
            </div>
          )}
        </section>
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

function SummaryCard({
  title,
  value,
  danger = false,
}: {
  title: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
        danger ? "border-red-100 bg-red-50" : "border-sky-100 bg-sky-50"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2
        className={`mt-2 line-clamp-2 break-words text-xl font-black leading-tight sm:text-2xl ${
          danger ? "text-red-700" : "text-slate-900"
        }`}
      >
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

function PainBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-red-600">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-black leading-6 text-slate-900 sm:text-base">
        {value}
      </p>
    </div>
  );
}