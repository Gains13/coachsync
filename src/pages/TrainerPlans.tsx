import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import TrainerLayout from "../components/TrainerLayout";
import PageHeader from "../components/ui/PageHeader";
import { btnPrimary, card } from "../components/ui/styles";

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
    <TrainerLayout>
        <PageHeader
          eyebrow="Organize weeks into plans"
          title="Training plans"
          description="Start a structured phase, keep Week 1–N inside that plan, and preserve every previous phase."
          actions={
            <Link
              to={
                selectedClientId
                  ? `/create-program?client=${selectedClientId}`
                  : "/create-program"
              }
              className={btnPrimary}
            >
              Create program
            </Link>
          }
        />

        <div className={`${card} p-5`}>
          <label className="mb-2 block text-sm font-semibold">Client</label>
          <select
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-4 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15 sm:max-w-md"
          >
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name} — {client.client_id}
              </option>
            ))}
          </select>

          {statusMessage && (
            <p className="mt-4 rounded-xl bg-canvas p-4 text-sm font-medium text-ink/80">
              {statusMessage}
            </p>
          )}
        </div>

        {selectedClientId && (
          <>
            <form
              onSubmit={createPlan}
              className="mt-6 rounded-[18px] border border-line bg-white p-5 sm:p-7"
            >
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                  New Phase
                </p>
                <h2 className="mt-1 text-2xl font-bold">Create a new training plan</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Create the plan container now. You can still program each week only when you are ready.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Plan Name">
                  <input
                    value={planName}
                    onChange={(event) => setPlanName(event.target.value)}
                    placeholder="6-Week Strength Foundation"
                    className="w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-accent/40 focus:ring-4 focus:ring-line"
                  />
                </Field>

                <Field label="Plan Type">
                  <select
                    value={planType}
                    onChange={(event) => setPlanType(event.target.value as "fixed" | "ongoing")}
                    className="w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-accent/40 focus:ring-4 focus:ring-line"
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
                    className="w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-accent/40 focus:ring-4 focus:ring-line disabled:bg-slate-100 disabled:text-muted"
                  />
                </Field>

                <Field label="Start Date (optional)">
                  <input
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    type="date"
                    className="w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-accent/40 focus:ring-4 focus:ring-line"
                  />
                </Field>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-2xl bg-canvas p-4">
                <input
                  type="checkbox"
                  checked={activateNow}
                  onChange={(event) => setActivateNow(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-bold text-ink">Make this the active plan now</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    The current active plan will be marked completed. Uncheck this to save the new plan as a draft.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={isCreating}
                className="mt-5 rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-dark disabled:opacity-60"
              >
                {isCreating ? "Creating..." : "Create Training Plan"}
              </button>
            </form>

            <section className="mt-6 rounded-[18px] border border-violet-100 bg-white p-5 sm:p-7">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                  Existing Programming
                </p>
                <h2 className="mt-1 text-2xl font-bold">Move an existing week</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
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
                className="mt-5 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {isMoving ? "Moving..." : "Move Week to Plan"}
              </button>
            </section>

            <section className="mt-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Plan History</p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {selectedClient?.full_name || "Client"}'s plans
                  </h2>
                </div>
                <p className="text-sm font-semibold text-muted">{plans.length} plan{plans.length === 1 ? "" : "s"}</p>
              </div>

              {isLoading ? (
                <div className="rounded-[18px] border border-line bg-white p-6 ">Loading plans...</div>
              ) : planCards.length === 0 ? (
                <div className="rounded-[18px] border border-line bg-white p-6 ">No plans yet.</div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  {planCards.map((plan) => (
                    <article key={plan.id} className="rounded-[18px] border border-line bg-white p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-bold text-ink">{plan.name}</h3>
                            <StatusBadge status={plan.status} />
                          </div>
                          <p className="mt-2 text-sm font-semibold text-muted">
                            {plan.plan_type === "fixed"
                              ? `${plan.planned_weeks || 0}-week plan`
                              : "Ongoing week-by-week"}
                            {plan.start_date ? ` • Starts ${new Date(`${plan.start_date}T00:00:00`).toLocaleDateString()}` : ""}
                          </p>
                        </div>

                        <Link
                          to={`/create-program?client=${selectedClientId}&plan=${plan.id}`}
                          className="rounded-xl bg-accent px-4 py-2 text-center text-sm font-bold text-white hover:bg-accent-dark"
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
                            className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
                          >
                            Make Active
                          </button>
                        )}
                        {plan.status !== "completed" && (
                          <button
                            type="button"
                            onClick={() => updatePlanStatus(plan.id, "completed")}
                            className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-bold text-accent ring-1 ring-line hover:bg-accent-soft"
                          >
                            Complete Plan
                          </button>
                        )}
                        {plan.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => updatePlanStatus(plan.id, "archived")}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-ink/80 hover:bg-slate-200"
                          >
                            Archive
                          </button>
                        )}
                      </div>

                      <div className="mt-5 space-y-2">
                        {plan.weeks.length === 0 ? (
                          <p className="rounded-2xl bg-canvas p-4 text-sm font-semibold text-muted">
                            No weeks created yet. Click Add Week when you are ready to program Week 1.
                          </p>
                        ) : (
                          plan.weeks.map((week) => (
                            <div key={week.id} className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3">
                              <div>
                                <p className="font-bold text-ink">Week {week.week_number}</p>
                                <p className="text-xs font-semibold text-muted">
                                  {week.client_plan_workouts?.length || 0} workout{week.client_plan_workouts?.length === 1 ? "" : "s"} • {week.status}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-accent">Saved</span>
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
    </TrainerLayout>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-ink/80">{label}</span>
      {children}
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-canvas p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-accent">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
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
      ? "bg-accent-soft text-accent ring-line"
      : "bg-slate-100 text-muted ring-slate-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ${classes}`}>
      {status}
    </span>
  );
}