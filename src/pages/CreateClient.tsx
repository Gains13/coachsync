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
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [createdClientEmail, setCreatedClientEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function createClientProfile(event: React.FormEvent) {
    event.preventDefault();

    if (!email.trim() || !fullName.trim() || !clientId.trim()) {
      setStatusMessage("Email, full name, and client ID are required.");
      return;
    }

    setIsSaving(true);
    setTemporaryPassword("");
    setCreatedClientEmail("");
    setStatusMessage("Creating client account...");

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();
    const cleanClientId = clientId.trim().toLowerCase();

    let newUserId = "";
    let newTemporaryPassword = "";

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setStatusMessage("You must be logged in as a trainer to create clients.");
        setIsSaving(false);
        return;
      }

      const response = await fetch("/api/invite-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: cleanFullName,
          clientId: cleanClientId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setStatusMessage(
          "Failed to create client account: " +
            (result.error || "Unknown error.")
        );
        setIsSaving(false);
        return;
      }

      newUserId = result.userId;
      newTemporaryPassword = result.temporaryPassword;

      if (!newUserId) {
        setStatusMessage(
          "Client account was created, but no user ID was returned. Check api/invite-client.js response."
        );
        setIsSaving(false);
        return;
      }

      if (!newTemporaryPassword) {
        setStatusMessage(
          "Client account was created, but no temporary password was returned. Check api/invite-client.js response."
        );
        setIsSaving(false);
        return;
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Network error creating client account. Check your connection.");
      setIsSaving(false);
      return;
    }

    const { error: assessmentError } = await supabase
      .from("client_assessments")
      .insert({
        client_user_id: newUserId,
        starting_weight: startingWeight.trim(),
        body_fat: bodyFat.trim(),
        muscle_mass: muscleMass.trim(),
        waist: waist.trim(),
        hips: hips.trim(),
        chest: chest.trim(),
        notes: assessmentNotes.trim(),
      });

    if (assessmentError) {
      console.error(assessmentError);
      setStatusMessage(
        "Client account created, but assessment failed: " +
          assessmentError.message
      );
      setIsSaving(false);
      return;
    }

    const { error: goalsError } = await supabase.from("client_goals").insert({
      client_user_id: newUserId,
      main_goal: mainGoal.trim(),
      short_term_goal: shortTermGoal.trim(),
      long_term_goal: longTermGoal.trim(),
      coach_notes: coachNotes.trim(),
    });

    if (goalsError) {
      console.error(goalsError);
      setStatusMessage(
        "Client account and assessment created, but goals failed: " +
          goalsError.message
      );
      setIsSaving(false);
      return;
    }

    setCreatedClientEmail(cleanEmail);
    setTemporaryPassword(newTemporaryPassword);
    setStatusMessage(
      "Client account created successfully. Copy the login details below and send them to the client."
    );

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

  function copyLoginDetails() {
    const message = `Hey! I created your CoachSync account.

Login link: https://coachsync-rust.vercel.app
Email: ${createdClientEmail}
Temporary password: ${temporaryPassword}

Once you log in, you’ll be able to view your plan, workouts, goals, and progress.`;

    navigator.clipboard.writeText(message);
    setStatusMessage("Login message copied. You can now send it to the client.");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-5 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:mb-8 sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Trainer Tools
                </p>

                <h1 className="mt-3 break-words text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
                  Create Client Profile
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  Create the client’s CoachSync login, assessment, and goals.
                  The app will generate a temporary password for you to send
                  manually.
                </p>
              </div>

              <Link
                to="/trainer"
                className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
              >
                Back to Trainer
              </Link>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-6 md:p-8">
            <SummaryCard title="Step 1" value="Client Info" />
            <SummaryCard title="Step 2" value="Assessment" />
            <SummaryCard title="Step 3" value="Goals" />
          </div>
        </div>

        <form
          onSubmit={createClientProfile}
          className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="space-y-6 sm:space-y-8">
            <FormSection
              title="Client Info"
              description="Enter the client's email and name. CoachSync will create their account and generate a temporary password."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  label="Client Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="client@email.com"
                  type="email"
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

              <p className="mt-3 text-sm leading-6 text-slate-500">
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
            <p className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium leading-6 text-slate-700">
              {statusMessage}
            </p>
          )}

          {temporaryPassword && createdClientEmail && (
            <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h2 className="text-lg font-bold text-emerald-900">
                Client Login Details
              </h2>

              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Copy these details now. The temporary password is only shown on
                this screen.
              </p>

              <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 text-sm text-slate-700">
                <p>
                  <span className="font-bold">Login link:</span>{" "}
                  https://coachsync-rust.vercel.app
                </p>

                <p>
                  <span className="font-bold">Email:</span>{" "}
                  {createdClientEmail}
                </p>

                <p className="break-all">
                  <span className="font-bold">Temporary password:</span>{" "}
                  {temporaryPassword}
                </p>
              </div>

              <button
                type="button"
                onClick={copyLoginDetails}
                className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
              >
                Copy Login Message
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Creating Client..." : "Create Client Account"}
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