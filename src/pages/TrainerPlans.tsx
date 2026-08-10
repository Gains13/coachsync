import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type TrainingPlan = {
  id: string;
  client_user_id: string;
  trainer_user_id: string | null;
  name: string;
  plan_type: "fixed" | "ongoing";
  planned_weeks: number | null;
  status: "draft" | "active" | "completed" | "archived";
  start_date: string | null;
  completed_at: string | null;
  created_at: string;
};

type PlanWeek = {
  id: string;
  client_user_id: string;
  plan_id: string | null;
  week_number: number;
  status: string;
  client_plan_workouts: { id: string; title: string }[];
};

export default function TrainerPlans() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trainerUserId, setTrainerUserId] = useState("");
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(
    searchParams.get("client") || ""
  );
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const [planName, setPlanName] = useState("");
  const [planType, setPlanType] = useState<"fixed" | "ongoing">("fixed");
  const [plannedWeeks, setPlannedWeeks] = useState("6");
  const [startDate, setStartDate] = useState("");
  const [activateNow, setActivateNow] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [moveWeekId, setMoveWeekId] = useState("");
  const [destinationPlanId, setDestinationPlanId] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      setSearchParams({ client: selectedClientId }, { replace: true });
      loadClientPlans(selectedClientId);
    } else {
      setPlans([]);
      setWeeks([]);
      setSearchParams({}, { replace: true });
    }
  }, [selectedClientId]);

  async function loadInitialData() {
    setIsLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in as a trainer to manage plans.");
      setIsLoading(false);
      return;
    }

    setTrainerUserId(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, client_id")
      .eq("role", "client")
      .order("full_name", { ascending: true });

    if (error) {
      setStatusMessage("Could not load clients: " + error.message);
      setIsLoading(false);
      return;
    }

    const loadedClients = (data || []) as ClientProfile[];
    setClients(loadedClients);

    const requestedClient = searchParams.get("client");
    if (requestedClient && loadedClients.some((client) => client.id === requestedClient)) {
      setSelectedClientId(requestedClient);
      await loadClientPlans(requestedClient);
    }

    setIsLoading(false);
  }

  async function loadClientPlans(clientUserId: string) {
    setIsLoading(true);
    setStatusMessage("");

    const [{ data: plansData, error: plansError }, { data: weeksData, error: weeksError }] =
      await Promise.all([
        supabase
          .from("training_plans")
          .select(
            "id, client_user_id, trainer_user_id, name, plan_type, planned_weeks, status, start_date, completed_at, created_at"
          )
          .eq("client_user_id", clientUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("client_plan_weeks")
          .select(
            `
            id,
            client_user_id,
            plan_id,
            week_number,
            status,
            client_plan_workouts (
              id,
              title
            )
          `
          )
          .eq("client_user_id", clientUserId)
          .order("week_number", { ascending: true }),
      ]);

    if (plansError) {
      setStatusMessage("Could not load training plans: " + plansError.message);
      setPlans([]);
    } else {
      const loadedPlans = (plansData || []) as TrainingPlan[];
      setPlans(loadedPlans);
      setDestinationPlanId((current) =>
        current && loadedPlans.some((plan) => plan.id === current)
          ? current
          : loadedPlans.find((plan) => plan.status === "active")?.id || loadedPlans[0]?.id || ""
      );
    }

    if (weeksError) {
      setStatusMessage((current) =>
        current || "Could not load assigned weeks: " + weeksError.message
      );
      setWeeks([]);
    } else {
      setWeeks((weeksData || []) as PlanWeek[]);
    }

    setIsLoading(false);
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault();

    if (!selectedClientId) {
      setStatusMessage("Select a client first.");
      return;
    }

    if (!planName.trim()) {
      setStatusMessage("Enter a name for the new plan.");
      return;
    }

    const weeksCount = planType === "fixed" ? Number(plannedWeeks) : null;
    if (planType === "fixed" && (!weeksCount || weeksCount < 1)) {
      setStatusMessage("A fixed plan needs at least 1 week.");
      return;
    }

    setIsCreating(true);
    setStatusMessage("Creating training plan...");

    if (activateNow) {
      const { error: closeError } = await supabase
        .from("training_plans")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("client_user_id", selectedClientId)
        .eq("status", "active");

      if (closeError) {
        setStatusMessage("Could not close the previous active plan: " + closeError.message);
        setIsCreating(false);
        return;
      }
    }

    const { error } = await supabase.from("training_plans").insert({
      client_user_id: selectedClientId,
      trainer_user_id: trainerUserId || null,
      name: planName.trim(),
      plan_type: planType,
      planned_weeks: weeksCount,
      status: activateNow ? "active" : "draft",
      start_date: startDate || null,
    });

    if (error) {
      setStatusMessage("Could not create training plan: " + error.message);
      setIsCreating(false);
      return;
    }

    setPlanName("");
    setPlanType("fixed");
    setPlannedWeeks("6");
    setStartDate("");
    setActivateNow(true);
    setStatusMessage("New training plan created. Week 1 is ready to be programmed.");
    await loadClientPlans(selectedClientId);
    setIsCreating(false);
  }

  async function updatePlanStatus(
    planId: string,
    status: TrainingPlan["status"]
  ) {
    if (!selectedClientId) return;

    setStatusMessage(`Updating plan to ${status}...`);

    if (status === "active") {
      const { error: otherPlanError } = await supabase
        .from("training_plans")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("client_user_id", selectedClientId)
        .eq("status", "active")
        .neq("id", planId);

      if (otherPlanError) {
        setStatusMessage("Could not update the previous active plan: " + otherPlanError.message);
        return;
      }
    }

    const { error } = await supabase
      .from("training_plans")
      .update({
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", planId);

    if (error) {
      setStatusMessage("Could not update plan: " + error.message);
      return;
    }

    setStatusMessage(`Plan marked ${status}.`);
    await loadClientPlans(selectedClientId);
  }

  async function moveExistingWeek() {
    if (!selectedClientId || !moveWeekId || !destinationPlanId) {
      setStatusMessage("Choose a week and destination plan first.");
      return;
    }

    const week = weeks.find((item) => item.id === moveWeekId);
    const destinationPlan = plans.find((plan) => plan.id === destinationPlanId);

    if (!week || !destinationPlan) {
      setStatusMessage("Could not find the selected week or plan.");
      return;
    }

    if (week.plan_id === destinationPlanId) {
      setStatusMessage("That week is already inside the selected plan.");
      return;
    }

    const destinationWeeks = weeks.filter((item) => item.plan_id === destinationPlanId);
    const nextWeekNumber =
      destinationWeeks.length > 0
        ? Math.max(...destinationWeeks.map((item) => item.week_number)) + 1
        : 1;

    if (
      destinationPlan.plan_type === "fixed" &&
      destinationPlan.planned_weeks &&
      nextWeekNumber > destinationPlan.planned_weeks
    ) {
      setStatusMessage(
        `${destinationPlan.name} is limited to ${destinationPlan.planned_weeks} weeks. Extend the plan before moving another week into it.`
      );
      return;
    }

    const sourceName = getPlanName(week.plan_id);
    const confirmed = window.confirm(
      `Move Week ${week.week_number} from ${sourceName} to ${destinationPlan.name} as Week ${nextWeekNumber}? Workouts and exercises will stay intact.`
    );

    if (!confirmed) return;

    setIsMoving(true);
    setStatusMessage("Moving week to the new plan...");

    const { error } = await supabase
      .from("client_plan_weeks")
      .update({
        plan_id: destinationPlanId,
        week_number: nextWeekNumber,
      })
      .eq("id", week.id);

    if (error) {
      setStatusMessage("Could not move week: " + error.message);
      setIsMoving(false);
      return;
    }

    setMoveWeekId("");
    setStatusMessage(
      `Moved the existing week into ${destinationPlan.name} as Week ${nextWeekNumber}.`
    );
    await loadClientPlans(selectedClientId);
    setIsMoving(false);
  }

  function getPlanName(planId: string | null) {
    if (!planId) return "Unassigned";
    return plans.find((plan) => plan.id === planId)?.name || "Unknown Plan";
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const planCards = useMemo(() => {
    return plans.map((plan) => ({
      ...plan,
      weeks: weeks
        .filter((week) => week.plan_id === plan.id)
        .sort((a, b) => a.week_number - b.week_number),
    }));
  }, [plans, weeks]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-600 px-5 py-7 text-white sm:px-8 sm:py-9">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
                  CoachSync
                </p>
                <h1 className="mt-2 text-3xl font-black sm:text-4xl">Training Plans</h1>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-blue-50 sm:text-base">
                  Start a structured phase, keep Week 1–N inside that plan, and preserve every previous phase.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to={selectedClientId ? `/create-program?client=${selectedClientId}` : "/create-program"}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-50"
                >
                  Create Program
                </Link>
                <Link
                  to="/trainer"
                  className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-black text-white ring-1 ring-white/30 hover:bg-white/25"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <label className="mb-2 block text-sm font-black text-slate-700">Client</label>
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 sm:max-w-xl"
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name} — {client.client_id}
                </option>
              ))}
            </select>

            {statusMessage && (
              <p className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold text-slate-700">
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        {selectedClientId && (
          <>
            <form
              onSubmit={createPlan}
              className="mt-6 rounded-[2rem] border border-sky-100 bg-white p-5 shadow-sm sm:p-7"
            >
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                  New Phase
                </p>
                <h2 className="mt-1 text-2xl font-black">Create a new training plan</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Create the plan container now. You can still program each week only when you are ready.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Plan Name">
                  <input
                    value={planName}
                    onChange={(event) => setPlanName(event.target.value)}
                    placeholder="6-Week Strength Foundation"
                    className="w-full rounded-2xl border border-sky-100 px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </Field>

                <Field label="Plan Type">
                  <select
                    value={planType}
                    onChange={(event) => setPlanType(event.target.value as "fixed" | "ongoing")}
                    className="w-full rounded-2xl border border-sky-100 px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="fixed">Fixed length</option>
                    <option value="ongoing">Ongoing / week-by-week</option>
                  </select>
                </Field>

                <Field label="Number of Weeks">
                  <input
                    value={plannedWeeks}
                    onChange={(event) => setPlannedWeeks(event.target.value)}
                    type="number"
                    min="1"
                    disabled={planType === "ongoing"}
                    className="w-full rounded-2xl border border-sky-100 px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </Field>

                <Field label="Start Date (optional)">
                  <input
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    type="date"
                    className="w-full rounded-2xl border border-sky-100 px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </Field>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-2xl bg-sky-50 p-4">
                <input
                  type="checkbox"
                  checked={activateNow}
                  onChange={(event) => setActivateNow(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-black text-slate-800">Make this the active plan now</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    The current active plan will be marked completed. Uncheck this to save the new plan as a draft.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={isCreating}
                className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isCreating ? "Creating..." : "Create Training Plan"}
              </button>
            </form>

            <section className="mt-6 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                  Existing Programming
                </p>
                <h2 className="mt-1 text-2xl font-black">Move an existing week</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use this for the week you already created for a new phase. Its workouts, exercises, notes and IDs stay intact.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Week to Move">
                  <select
                    value={moveWeekId}
                    onChange={(event) => setMoveWeekId(event.target.value)}
                    className="w-full rounded-2xl border border-violet-100 px-4 py-3 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="">Select existing week</option>
                    {weeks.map((week) => (
                      <option key={week.id} value={week.id}>
                        {getPlanName(week.plan_id)} — Week {week.week_number} — {week.client_plan_workouts?.length || 0} workout{week.client_plan_workouts?.length === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Move Into">
                  <select
                    value={destinationPlanId}
                    onChange={(event) => setDestinationPlanId(event.target.value)}
                    className="w-full rounded-2xl border border-violet-100 px-4 py-3 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="">Select destination plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {plan.status}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <button
                type="button"
                onClick={moveExistingWeek}
                disabled={isMoving || !moveWeekId || !destinationPlanId}
                className="mt-5 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {isMoving ? "Moving..." : "Move Week to Plan"}
              </button>
            </section>

            <section className="mt-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Plan History</p>
                  <h2 className="mt-1 text-2xl font-black">
                    {selectedClient?.full_name || "Client"}'s plans
                  </h2>
                </div>
                <p className="text-sm font-semibold text-slate-500">{plans.length} plan{plans.length === 1 ? "" : "s"}</p>
              </div>

              {isLoading ? (
                <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">Loading plans...</div>
              ) : planCards.length === 0 ? (
                <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">No plans yet.</div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  {planCards.map((plan) => (
                    <article key={plan.id} className="rounded-[2rem] border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                            <StatusBadge status={plan.status} />
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-500">
                            {plan.plan_type === "fixed"
                              ? `${plan.planned_weeks || 0}-week plan`
                              : "Ongoing week-by-week"}
                            {plan.start_date ? ` • Starts ${new Date(`${plan.start_date}T00:00:00`).toLocaleDateString()}` : ""}
                          </p>
                        </div>

                        <Link
                          to={`/create-program?client=${selectedClientId}&plan=${plan.id}`}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-black text-white hover:bg-blue-700"
                        >
                          Add Week
                        </Link>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <MiniStat label="Weeks Created" value={String(plan.weeks.length)} />
                        <MiniStat
                          label="Plan Length"
                          value={plan.plan_type === "fixed" ? String(plan.planned_weeks || 0) : "Ongoing"}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {plan.status !== "active" && (
                          <button
                            type="button"
                            onClick={() => updatePlanStatus(plan.id, "active")}
                            className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
                          >
                            Make Active
                          </button>
                        )}
                        {plan.status !== "completed" && (
                          <button
                            type="button"
                            onClick={() => updatePlanStatus(plan.id, "completed")}
                            className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
                          >
                            Complete Plan
                          </button>
                        )}
                        {plan.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => updatePlanStatus(plan.id, "archived")}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                          >
                            Archive
                          </button>
                        )}
                      </div>

                      <div className="mt-5 space-y-2">
                        {plan.weeks.length === 0 ? (
                          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                            No weeks created yet. Click Add Week when you are ready to program Week 1.
                          </p>
                        ) : (
                          plan.weeks.map((week) => (
                            <div key={week.id} className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3">
                              <div>
                                <p className="font-black text-slate-900">Week {week.week_number}</p>
                                <p className="text-xs font-semibold text-slate-500">
                                  {week.client_plan_workouts?.length || 0} workout{week.client_plan_workouts?.length === 1 ? "" : "s"} • {week.status}
                                </p>
                              </div>
                              <span className="text-xs font-black text-blue-700">Saved</span>
                            </div>
                          ))
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-sky-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: TrainingPlan["status"] }) {
  const classes =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "draft"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : status === "completed"
      ? "bg-blue-50 text-blue-700 ring-blue-100"
      : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${classes}`}>
      {status}
    </span>
  );
}