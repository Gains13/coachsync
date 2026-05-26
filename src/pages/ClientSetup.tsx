import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ClientSetup() {
  const navigate = useNavigate();

  const [clientUserId, setClientUserId] = useState("");
  const [fullName, setFullName] = useState("");

  const [mainGoal, setMainGoal] = useState("");
  const [shortTermGoal, setShortTermGoal] = useState("");
  const [longTermGoal, setLongTermGoal] = useState("");
  const [coachNotes, setCoachNotes] = useState("");

  const [messageBody, setMessageBody] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadClientSetup();
  }, []);

  async function loadClientSetup() {
    setIsLoading(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in to complete setup.");
      setIsLoading(false);
      return;
    }

    setClientUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && profile?.full_name) {
      setFullName(profile.full_name);
    }

    const { data: goals, error: goalsError } = await supabase
      .from("client_goals")
      .select("main_goal, short_term_goal, long_term_goal, coach_notes")
      .eq("client_user_id", user.id)
      .maybeSingle();

    if (!goalsError && goals) {
      setMainGoal(goals.main_goal || "");
      setShortTermGoal(goals.short_term_goal || "");
      setLongTermGoal(goals.long_term_goal || "");
      setCoachNotes(goals.coach_notes || "");
    }

    setIsLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!clientUserId) {
      setStatusMessage("Client user ID was not found. Please log in again.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving your setup...");

    const { error: goalsError } = await supabase.from("client_goals").upsert(
      {
        client_user_id: clientUserId,
        main_goal: mainGoal.trim(),
        short_term_goal: shortTermGoal.trim(),
        long_term_goal: longTermGoal.trim(),
        coach_notes: coachNotes.trim(),
      },
      { onConflict: "client_user_id" }
    );

    if (goalsError) {
      setStatusMessage("Goals save failed: " + goalsError.message);
      setIsSaving(false);
      return;
    }

    if (messageBody.trim()) {
      const { error: messageError } = await supabase.from("messages").insert({
        client_user_id: clientUserId,
        sender_user_id: clientUserId,
        receiver_user_id: null,
        message_body: messageBody.trim(),
      });

      if (messageError) {
        setStatusMessage("Message save failed: " + messageError.message);
        setIsSaving(false);
        return;
      }
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ setup_complete: true })
      .eq("id", clientUserId);

    if (profileError) {
      setStatusMessage(
        "Setup saved, but profile update failed: " + profileError.message
      );
      setIsSaving(false);
      return;
    }

    setStatusMessage("Setup complete. Taking you to your dashboard...");
    setIsSaving(false);

    setTimeout(() => {
      navigate("/client");
    }, 900);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-4xl rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
          <p className="text-slate-600">Loading your setup...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-5 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:mb-8 sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Client Setup
                </p>

                <h1 className="mt-3 break-words text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
                  Welcome{fullName ? `, ${fullName}` : ""}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Set your goals and send your trainer a quick message before
                  using your dashboard.
                </p>
              </div>

              <Link
                to="/client"
                className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
              >
                Skip to Dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 md:p-8">
            <SummaryCard title="Step 1" value="Goals" />
            <SummaryCard title="Step 2" value="Message" />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="space-y-6 sm:space-y-8">
            <FormSection
              title="Your Goals"
              description="Review or update your main goal, short-term goal, and long-term goal."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  label="Main Goal"
                  value={mainGoal}
                  onChange={setMainGoal}
                  placeholder="Build muscle and strength"
                />

                <Input
                  label="Short-Term Goal"
                  value={shortTermGoal}
                  onChange={setShortTermGoal}
                  placeholder="Complete the first 2 weeks consistently"
                />

                <Input
                  label="Long-Term Goal"
                  value={longTermGoal}
                  onChange={setLongTermGoal}
                  placeholder="Feel confident training independently"
                />
              </div>

              <TextArea
                label="Notes for Trainer"
                value={coachNotes}
                onChange={setCoachNotes}
                placeholder="What do you want your trainer to know about your goals?"
              />
            </FormSection>

            <FormSection
              title="Message Your Trainer"
              description="Send your trainer a quick first message. This is optional."
            >
              <TextArea
                label="Message"
                value={messageBody}
                onChange={setMessageBody}
                placeholder="Hey coach, here is what I want to focus on first..."
              />
            </FormSection>
          </div>

          {statusMessage && (
            <p className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium leading-6 text-slate-700">
              {statusMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving Setup..." : "Save Setup"}
          </button>
        </form>
      </section>
    </main>
  );
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

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      {children}
    </section>
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
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
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
    <div className="mt-4">
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}