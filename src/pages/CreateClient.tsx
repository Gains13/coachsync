import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import TrainerLayout from "../components/TrainerLayout";
import PageHeader from "../components/ui/PageHeader";

export default function CreateClient() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [clientId, setClientId] = useState("");

  const [startingWeight, setStartingWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [visceralFat, setVisceralFat] = useState("");
  const [bmi, setBmi] = useState("");
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

        // Keeping existing database columns so nothing breaks:
        // waist = visceral fat
        // hips = BMI
        // chest = unused/blank for now
        waist: visceralFat.trim(),
        hips: bmi.trim(),
        chest: "",

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
    setVisceralFat("");
    setBmi("");
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
    <TrainerLayout>
        <PageHeader
          backTo="/clients"
          backLabel="Clients"
          title="Add client"
          description="Creates their CoachSync login, assessment and goals. A temporary password is generated for you to send them."
        />


        <form
          onSubmit={createClientProfile}
          className="rounded-[18px] border border-line bg-white p-4 sm:p-6"
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

              <p className="mt-3 text-sm leading-6 text-muted">
                Client ID should be simple lowercase text like adam, suzanne, or
                robert.
              </p>
            </FormSection>

            <FormSection
              title="Assessment"
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
                  label="Visceral Fat"
                  value={visceralFat}
                  onChange={setVisceralFat}
                  placeholder="10"
                />

                <Input
                  label="BMI"
                  value={bmi}
                  onChange={setBmi}
                  placeholder="27.5"
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
            <p className="mt-6 rounded-2xl border border-line bg-canvas p-4 text-sm font-medium leading-6 text-ink/80">
              {statusMessage}
            </p>
          )}

          {temporaryPassword && createdClientEmail && (
            <div className="mt-6 rounded-[18px] border border-emerald-100 bg-emerald-50 p-5">
              <h2 className="text-lg font-bold text-emerald-900">
                Client Login Details
              </h2>

              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Copy these details now. The temporary password is only shown on
                this screen.
              </p>

              <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 text-sm text-ink/80">
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
                className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 sm:w-auto"
              >
                Copy Login Message
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-2xl bg-accent px-5 py-4 font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Creating Client..." : "Create Client Account"}
          </button>
        </form>
    </TrainerLayout>
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
    <section className="rounded-[18px] border border-line bg-canvas p-4 sm:p-5">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-ink sm:text-xl">{title}</h2>

        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
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
      <label className="mb-2 block text-sm font-semibold text-ink/80">
        {label}
      </label>

      <input
        value={value}
        type={type}
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
    <div className="mt-4">
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