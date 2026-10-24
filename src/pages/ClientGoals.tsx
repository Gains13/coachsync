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
        <section className="rounded-[18px] border border-line bg-white p-6 sm:rounded-[18px] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-bold text-ink">
            Loading goals...
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted">
            Please wait while we load your training goals.
          </p>
        </section>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="mb-4 sm:mb-6">
        <div className="mb-4">
          <p className="text-sm text-muted">
            Client Goals
          </p>

          <h1 className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-[30px]">
            Goals
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            View your training goals and update them whenever your focus
            changes.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <SummaryCard title="Main Goal" value={mainGoal || "Not set"} />
          <SummaryCard
            title="Short Term"
            value={shortTermGoal || "Not set"}
          />
          <SummaryCard title="Long Term" value={longTermGoal || "Not set"} />
          <SummaryCard title="Messages" value={`${unreadMessages}`} />
        </div>
      </section>

      <section className="rounded-[18px] border border-line bg-white p-4 sm:rounded-[18px] sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              Training Focus
            </p>

            <h2 className="mt-1 text-xl font-bold text-ink sm:text-2xl">
              Your Goals
            </h2>

            <p className="mt-1 text-sm leading-6 text-muted">
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
              className="w-full rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-dark active:scale-[0.99] sm:w-auto"
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
              <p className="rounded-2xl border border-line bg-canvas p-4 text-sm font-semibold text-ink/80">
                {statusMessage}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-2xl bg-accent px-5 py-4 text-sm font-bold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
                className="w-full rounded-2xl border border-line bg-white px-5 py-4 text-sm font-bold text-ink/80 transition hover:bg-canvas sm:w-auto"
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

            <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
              <p className="text-sm font-bold text-muted">
                Notes for Trainer
              </p>

              <p className="mt-2 text-sm leading-6 text-ink/80 sm:text-base">
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
    <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-line sm:h-12 sm:w-12">
        {icon}
      </div>

      <p className="text-sm font-bold text-muted">{label}</p>

      <p className="mt-2 text-base font-bold leading-7 text-ink sm:text-lg">
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
    <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl ring-1 ring-line sm:h-12 sm:w-12">
        {icon}
      </div>

      <label className="mb-2 block text-sm font-bold text-ink/80">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/40 focus:ring-4 focus:ring-line"
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
    <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
      <label className="mb-2 block text-sm font-bold text-ink/80">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/40 focus:ring-4 focus:ring-line"
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
    <div className="rounded-2xl border border-line bg-canvas p-4 ">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {title}
      </p>

      <h2 className="mt-2 line-clamp-2 break-words text-xl font-bold leading-tight text-ink sm:text-2xl">
        {value}
      </h2>
    </div>
  );
}