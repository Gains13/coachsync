import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

export default function ClientAssessment() {
  const [clientUserId, setClientUserId] = useState("");

  const [startingWeight, setStartingWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [chest, setChest] = useState("");
  const [notes, setNotes] = useState("");

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadAssessment();
  }, []);

  async function loadAssessment() {
    setIsLoading(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in to view your assessment.");
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
      .from("client_assessments")
      .select(
        "starting_weight, body_fat, muscle_mass, waist, hips, chest, notes"
      )
      .eq("client_user_id", user.id)
      .maybeSingle();

    if (error) {
      setStatusMessage("Could not load assessment: " + error.message);
      setIsLoading(false);
      return;
    }

    if (data) {
      setStartingWeight(data.starting_weight || "");
      setBodyFat(data.body_fat || "");
      setMuscleMass(data.muscle_mass || "");
      setWaist(data.waist || "");
      setHips(data.hips || "");
      setChest(data.chest || "");
      setNotes(data.notes || "");
    }

    setIsLoading(false);
  }

  async function saveAssessment(event: React.FormEvent) {
    event.preventDefault();

    if (!clientUserId) {
      setStatusMessage("Client account not found. Please log in again.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving your assessment...");

    const { error } = await supabase.from("client_assessments").upsert(
      {
        client_user_id: clientUserId,
        starting_weight: startingWeight.trim(),
        body_fat: bodyFat.trim(),
        muscle_mass: muscleMass.trim(),
        waist: waist.trim(),
        hips: hips.trim(),
        chest: chest.trim(),
        notes: notes.trim(),
      },
      { onConflict: "client_user_id" }
    );

    if (error) {
      setStatusMessage("Assessment save failed: " + error.message);
      setIsSaving(false);
      return;
    }

    setStatusMessage("Assessment saved successfully.");
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
            Loading assessment...
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted">
            Please wait while we load your starting information.
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
            Client Assessment
          </p>

          <h1 className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-[30px]">
            Initial Assessment
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            View your starting measurements. Edit them only if something needs
            to be updated.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <SummaryCard
            title="Weight"
            value={startingWeight || "Not set"}
          />

          <SummaryCard title="Body Fat" value={bodyFat || "Not set"} />

          <SummaryCard
            title="Muscle Mass"
            value={muscleMass || "Not set"}
          />

          <SummaryCard
            title="Messages"
            value={`${unreadMessages}`}
            alert={unreadMessages > 0}
          />
        </div>
      </section>

      <section className="rounded-[18px] border border-line bg-white p-4 sm:rounded-[18px] sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              Starting Point
            </p>

            <h2 className="mt-1 text-xl font-bold text-ink sm:text-2xl">
              Your Assessment
            </h2>

            <p className="mt-1 text-sm leading-6 text-muted">
              These measurements help your trainer track your starting point and
              progress.
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
              Edit Assessment
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={saveAssessment} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
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
                value={waist}
                onChange={setWaist}
                placeholder="Example: 8"
              />

              <Input
                label="BMI"
                value={hips}
                onChange={setHips}
                placeholder="Example: 24.5"
              />

              <Input
                label="Chest"
                value={chest}
                onChange={setChest}
                placeholder="Optional"
              />
            </div>

            <TextArea
              label="Assessment Notes"
              value={notes}
              onChange={setNotes}
              placeholder="Movement notes, limitations, flexibility notes, or anything your trainer should know..."
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
                {isSaving ? "Saving Assessment..." : "Save Assessment"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusMessage("");
                  setIsEditing(false);
                  loadAssessment();
                }}
                className="w-full rounded-2xl border border-line bg-white px-5 py-4 text-sm font-bold text-ink/80 transition hover:bg-canvas sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard
                label="Starting Weight"
                value={startingWeight || "Not added yet"}
              />

              <InfoCard label="Body Fat" value={bodyFat || "Not added yet"} />

              <InfoCard
                label="Muscle Mass"
                value={muscleMass || "Not added yet"}
              />

              <InfoCard
                label="Visceral Fat"
                value={waist || "Not added yet"}
              />

              <InfoCard label="BMI" value={hips || "Not added yet"} />

              <InfoCard label="Chest" value={chest || "Not added yet"} />
            </div>

            <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
              <p className="text-sm font-bold text-muted">
                Assessment Notes
              </p>

              <p className="mt-2 text-sm leading-6 text-ink/80 sm:text-base">
                {notes || "No assessment notes added yet."}
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
      <p className="text-sm font-bold text-muted">{label}</p>

      <p className="mt-2 break-words text-xl font-bold text-ink">
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
  alert = false,
}: {
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4  ${
        alert ? "border-accent/30 bg-accent-soft" : "border-line bg-canvas"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {title}
      </p>

      <h2
        className={`mt-2 line-clamp-2 break-words text-xl font-bold leading-tight sm:text-2xl ${
          alert ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}