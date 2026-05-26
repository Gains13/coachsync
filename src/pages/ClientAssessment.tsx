import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ClientAssessment() {
  const [clientUserId, setClientUserId] = useState("");

  const [startingWeight, setStartingWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [chest, setChest] = useState("");
  const [notes, setNotes] = useState("");

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

    const { data, error } = await supabase
      .from("client_assessments")
      .select("starting_weight, body_fat, muscle_mass, waist, hips, chest, notes")
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
      <PageShell title="Assessment" subtitle="Loading your assessment...">
        <p className="text-slate-600">Please wait...</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Initial Assessment"
      subtitle="View your starting measurements. Edit them only if something needs to be updated."
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Your Assessment
          </h2>
          <p className="mt-1 text-sm text-slate-500">
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
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
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
            value={notes}
            onChange={setNotes}
            placeholder="Movement notes, limitations, flexibility notes, or anything your trainer should know..."
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
              {isSaving ? "Saving Assessment..." : "Save Assessment"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusMessage("");
                setIsEditing(false);
                loadAssessment();
              }}
              className="w-full rounded-2xl border border-sky-100 bg-white px-5 py-4 font-semibold text-slate-700 shadow-sm transition hover:bg-sky-50 sm:w-auto"
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

            <InfoCard label="Waist" value={waist || "Not added yet"} />

            <InfoCard label="Hips" value={hips || "Not added yet"} />

            <InfoCard label="Chest" value={chest || "Not added yet"} />
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
            <p className="text-sm font-medium text-slate-500">
              Assessment Notes
            </p>
            <p className="mt-2 leading-6 text-slate-700">
              {notes || "No assessment notes added yet."}
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
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
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
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