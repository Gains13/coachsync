import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function CreateClient() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [clientId, setClientId] = useState("");
  const [startingWeight, setStartingWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [chest, setChest] = useState("");
  const [assessmentNotes, setAssessmentNotes] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [shortTermGoal, setShortTermGoal] = useState("");
  const [longTermGoal, setLongTermGoal] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function createClientProfile(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !fullName || !clientId) {
      setStatusMessage("Email, full name, and client ID are required.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    const cleanClientId = clientId.trim().toLowerCase();

    // Step 1 — Send invite email and get new user ID back
    let newUserId = "";

    try {
      const response = await fetch(
  "https://vwbnhkhygqgzuzamonzs.supabase.co/functions/v1/invite-client",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), clientId: cleanClientId }),
  }
);

      const result = await response.json();

      if (!response.ok) {
        setStatusMessage("Failed to send invite: " + result.error);
        setIsSaving(false);
        return;
      }

      newUserId = result.userId;
    } catch (err) {
      setStatusMessage("Network error sending invite. Check your connection.");
      setIsSaving(false);
      return;
    }

    if (!newUserId) {
      setStatusMessage("Invite sent but no user ID returned. Check Supabase.");
      setIsSaving(false);
      return;
    }

    // Step 2 — Create profile row
    const { error: profileError } = await supabase.from("profiles").insert({
      id: newUserId,
      role: "client",
      full_name: fullName.trim(),
      client_id: cleanClientId,
    });

    if (profileError) {
      console.error(profileError);
      setStatusMessage(profileError.message);
      setIsSaving(false);
      return;
    }

    // Step 3 — Create assessment
    const { error: assessmentError } = await supabase
      .from("client_assessments")
      .insert({
        client_user_id: newUserId,
        starting_weight: startingWeight,
        body_fat: bodyFat,
        muscle_mass: muscleMass,
        waist,
        hips,
        chest,
        notes: assessmentNotes,
      });

    if (assessmentError) {
      console.error(assessmentError);
      setStatusMessage(
        "Profile created but assessment failed: " + assessmentError.message
      );
      setIsSaving(false);
      return;
    }

    // Step 4 — Create goals
    const { error: goalsError } = await supabase.from("client_goals").insert({
      client_user_id: newUserId,
      main_goal: mainGoal,
      short_term_goal: shortTermGoal,
      long_term_goal: longTermGoal,
      coach_notes: coachNotes,
    });

    if (goalsError) {
      console.error(goalsError);
      setStatusMessage(
        "Profile and assessment created but goals failed: " + goalsError.message
      );
      setIsSaving(false);
      return;
    }

    setStatusMessage(
      "Client profile created and invite email sent to " + email.trim()
    );

    // Reset all fields
    setEmail("");
    setFullName("");
    setClientId("");
    setStartingWeight("");
    setBodyFat("");
    setMuscleMass("");
    setWaist("");
    setHips("");
    setChest("");
    setAssessmentNotes("");
    setMainGoal("");
    setShortTermGoal("");
    setLongTermGoal("");
    setCoachNotes("");
    setIsSaving(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Trainer Tools
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  Create Client Profile
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  Fill out the form below. The client will automatically receive
                  an invite email to set up their account.
                </p>
              </div>

              <Link
                to="/trainer"
                className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
              >
                Back to Trainer
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
            <SummaryCard title="Step 1" value="Client Info" />
            <SummaryCard title="Step 2" value="Assessment" />
            <SummaryCard title="Step 3" value="Goals" />
          </div>
        </div>

        <form
          onSubmit={createClientProfile}
          className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm"
        >
          <div className="space-y-8">
            <FormSection
              title="Client Info"
              description="Enter the client's email and name. They will receive an invite link automatically."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  label="Client Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="client@email.com"
                />

                <Input
                  label="Full Name"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Adam Smith"
                />

                <Input
                  label="Client ID"
                  value={clientId}
                  onChange={setClientId}
                  placeholder="adam"
                />
              </div>

              <p className="mt-3 text-sm text-slate-500">
                Client ID should be simple lowercase text like adam, suzanne, or
                robert.
              </p>
            </FormSection>

            <FormSection
              title="Initial Assessment"
              description="Record the client's starting measurements and baseline notes."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  label="Starting Weight"
                  value={startingWeight}
                  onChange={setStartingWeight}
                  placeholder="180 lbs"
                />

                <Input
                  label="Body Fat"
                  value={bodyFat}
                  onChange={setBodyFat}
                  placeholder="18%"
                />

                <Input
                  label="Muscle Mass"
                  value={muscleMass}
                  onChange={setMuscleMass}
                  placeholder="140 lbs"
                />

                <Input
                  label="Waist"
                  value={waist}
                  onChange={setWaist}
                  placeholder="34 in"
                />

                <Input
                  label="Hips"
                  value={hips}
                  onChange={setHips}
                  placeholder="40 in"
                />

                <Input
                  label="Chest"
                  value={chest}
                  onChange={setChest}
                  placeholder="42 in"
                />
              </div>

              <TextArea
                label="Assessment Notes"
                value={assessmentNotes}
                onChange={setAssessmentNotes}
                placeholder="Posture notes, movement limitations, baseline notes..."
              />
            </FormSection>

            <FormSection
              title="Client Goals"
              description="Set the client's main goal, short-term focus, and long-term target."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  label="Main Goal"
                  value={mainGoal}
                  onChange={setMainGoal}
                  placeholder="Build strength"
                />

                <Input
                  label="Short-Term Goal"
                  value={shortTermGoal}
                  onChange={setShortTermGoal}
                  placeholder="Complete Week 1 consistently"
                />

                <Input
                  label="Long-Term Goal"
                  value={longTermGoal}
                  onChange={setLongTermGoal}
                  placeholder="Train independently by end of summer"
                />
              </div>

              <TextArea
                label="Coach Notes"
                value={coachNotes}
                onChange={setCoachNotes}
                placeholder="Anything you want to remember as the trainer..."
              />
            </FormSection>
          </div>

          {statusMessage && (
            <p className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium text-slate-700">
              {statusMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Creating Client..." : "Create Client & Send Invite"}
          </button>
        </form>
      </section>
    </main>
  );
}

// — Sub-components unchanged below —

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">{value}</h2>
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
    <section className="rounded-3xl border border-sky-100 bg-sky-50 p-5">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
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
        onChange={(e) => onChange(e.target.value)}
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}