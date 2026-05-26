import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ClientGoals() {
  const [clientUserId, setClientUserId] = useState("");

  const [mainGoal, setMainGoal] = useState("");
  const [shortTermGoal, setShortTermGoal] = useState("");
  const [longTermGoal, setLongTermGoal] = useState("");
  const [coachNotes, setCoachNotes] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    setIsLoading(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in to view your goals.");
      setIsLoading(false);
      return;
    }

    setClientUserId(user.id);

    const { data, error } = await supabase
      .from("client_goals")
      .select("main_goal, short_term_goal, long_term_goal, coach_notes")
      .eq("client_user_id", user.id)
      .maybeSingle();

    if (error) {
      setStatusMessage("Could not load goals: " + error.message);
      setIsLoading(false);
      return;
    }

    if (data) {
      setMainGoal(data.main_goal || "");
      setShortTermGoal(data.short_term_goal || "");
      setLongTermGoal(data.long_term_goal || "");
      setCoachNotes(data.coach_notes || "");
    }

    setIsLoading(false);
  }

  async function saveGoals(event: React.FormEvent) {
    event.preventDefault();

    if (!clientUserId) {
      setStatusMessage("Client account not found. Please log in again.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving your goals...");

    const { error } = await supabase.from("client_goals").upsert(
      {
        client_user_id: clientUserId,
        main_goal: mainGoal.trim(),
        short_term_goal: shortTermGoal.trim(),
        long_term_goal: longTermGoal.trim(),
        coach_notes: coachNotes.trim(),
      },
      { onConflict: "client_user_id" }
    );

    if (error) {
      setStatusMessage("Goals save failed: " + error.message);
      setIsSaving(false);
      return;
    }

    setStatusMessage("Goals saved successfully.");
    setIsEditing(false);
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <PageShell title="Goals" subtitle="Loading your goals...">
        <p className="text-slate-600">Please wait...</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Goals"
      subtitle="View your training goals. Edit them whenever your focus changes."
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Your Goals</h2>
          <p className="mt-1 text-sm text-slate-500">
            These goals help your trainer understand what you are working toward.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => {
              setStatusMessage("");
              setIsEditing(true);
            }}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Edit Goals
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={saveGoals} className="space-y-5">
          <Input
            label="Main Goal"
            value={mainGoal}
            onChange={setMainGoal}
            placeholder="Build muscle and strength"
            icon="🎯"
          />

          <Input
            label="Short-Term Goal"
            value={shortTermGoal}
            onChange={setShortTermGoal}
            placeholder="Complete the first 2 weeks consistently"
            icon="⚡"
          />

          <Input
            label="Long-Term Goal"
            value={longTermGoal}
            onChange={setLongTermGoal}
            placeholder="Feel confident training independently"
            icon="🏆"
          />

          <TextArea
            label="Notes for Trainer"
            value={coachNotes}
            onChange={setCoachNotes}
            placeholder="What do you want your trainer to know about your goals?"
          />

          {statusMessage && (
            <p className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium text-slate-700">
              {statusMessage}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSaving ? "Saving Goals..." : "Save Goals"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusMessage("");
                setIsEditing(false);
                loadGoals();
              }}
              className="w-full rounded-2xl border border-sky-100 bg-white px-5 py-4 font-semibold text-slate-700 shadow-sm transition hover:bg-sky-50 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-5">
          <GoalCard
            label="Main Goal"
            value={mainGoal || "No main goal added yet."}
            icon="🎯"
          />

          <GoalCard
            label="Short-Term Goal"
            value={shortTermGoal || "No short-term goal added yet."}
            icon="⚡"
          />

          <GoalCard
            label="Long-Term Goal"
            value={longTermGoal || "No long-term goal added yet."}
            icon="🏆"
          />

          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
            <p className="text-sm font-medium text-slate-500">
              Notes for Trainer
            </p>
            <p className="mt-2 leading-6 text-slate-700">
              {coachNotes || "No notes added yet."}
            </p>
          </div>

          {statusMessage && (
            <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              {statusMessage}
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}

function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              CoachSync
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-slate-500">{subtitle}</p>
          </div>

          <Link
            to="/client"
            className="rounded-xl border border-sky-100 bg-white px-4 py-2 text-center text-sm font-semibold text-blue-600 shadow-sm hover:bg-sky-50"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          {children}
        </div>
      </section>
    </main>
  );
}

function GoalCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-sky-100">
        {icon}
      </div>

      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold leading-7 text-slate-900">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-sky-100">
        {icon}
      </div>

      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
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
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}