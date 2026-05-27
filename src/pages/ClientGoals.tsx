import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

export default function ClientGoals() {
  const [clientUserId, setClientUserId] = useState("");

  const [mainGoal, setMainGoal] = useState("");
  const [shortTermGoal, setShortTermGoal] = useState("");
  const [longTermGoal, setLongTermGoal] = useState("");
  const [coachNotes, setCoachNotes] = useState("");

  const [unreadMessages, setUnreadMessages] = useState(0);
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
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Loading goals...
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Please wait while we load your training goals.
          </p>
        </section>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:mb-6 sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
            Client Goals
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            Goals
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
            View your training goals and update them whenever your focus
            changes.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
          <SummaryCard title="Main Goal" value={mainGoal || "Not set"} />
          <SummaryCard
            title="Short Term"
            value={shortTermGoal || "Not set"}
          />
          <SummaryCard title="Long Term" value={longTermGoal || "Not set"} />
          <SummaryCard title="Messages" value={`${unreadMessages}`} />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Training Focus
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
              Your Goals
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              These goals help your trainer understand what you are working
              toward.
            </p>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                setStatusMessage("");
                setIsEditing(true);
              }}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] sm:w-auto"
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
              <p className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold text-slate-700">
                {statusMessage}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
                className="w-full rounded-2xl border border-sky-100 bg-white px-5 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-sky-50 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 sm:gap-5">
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

            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
              <p className="text-sm font-bold text-slate-500">
                Notes for Trainer
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">
                {coachNotes || "No notes added yet."}
              </p>
            </div>

            {statusMessage && (
              <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                {statusMessage}
              </p>
            )}
          </div>
        )}
      </section>
    </ClientLayout>
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
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-sky-100 sm:h-12 sm:w-12">
        {icon}
      </div>

      <p className="text-sm font-bold text-slate-500">{label}</p>

      <p className="mt-2 text-base font-black leading-7 text-slate-900 sm:text-lg">
        {value}
      </p>
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
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-sky-100 sm:h-12 sm:w-12">
        {icon}
      </div>

      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <label className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2 className="mt-2 line-clamp-2 break-words text-xl font-black leading-tight text-slate-900 sm:text-2xl">
        {value}
      </h2>
    </div>
  );
}