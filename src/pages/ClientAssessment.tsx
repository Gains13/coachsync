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
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
            CoachSync
          </p>

          <h1 className="mt-3 text-2xl font-black text-slate-900">
            Loading assessment...
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Please wait while we load your starting information.
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
            Client Assessment
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            Initial Assessment
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
            View your starting measurements. Edit them only if something needs
            to be updated.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-6 md:grid-cols-4 md:p-8">
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

      <section className="rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Starting Point
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
              Your Assessment
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
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
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] sm:w-auto"
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
                {isSaving ? "Saving Assessment..." : "Save Assessment"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusMessage("");
                  setIsEditing(false);
                  loadAssessment();
                }}
                className="w-full rounded-2xl border border-sky-100 bg-white px-5 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-sky-50 sm:w-auto"
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

            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
              <p className="text-sm font-bold text-slate-500">
                Assessment Notes
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">
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
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>

      <p className="mt-2 break-words text-xl font-black text-slate-900">
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
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
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
  alert = false,
}: {
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        alert ? "border-blue-200 bg-blue-50" : "border-sky-100 bg-sky-50"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <h2
        className={`mt-2 line-clamp-2 break-words text-xl font-black leading-tight sm:text-2xl ${
          alert ? "text-blue-700" : "text-slate-900"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}