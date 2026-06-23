import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
  created_at: string;
  setup_complete: boolean | null;
};

export default function Clients() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [resettingClientId, setResettingClientId] = useState<string | null>(null);
  const [lastResetLink, setLastResetLink] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setIsLoading(true);
    setStatusMessage("");
    setLastResetLink("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, client_id, created_at, setup_complete")
      .eq("role", "client")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatusMessage("Could not load clients: " + error.message);
      setIsLoading(false);
      return;
    }

    setClients(data || []);
    setIsLoading(false);
  }

  async function generateClientResetLink(client: ClientProfile) {
    setResettingClientId(client.id);
    setLastResetLink("");
    setStatusMessage(`Generating reset link for ${client.full_name}...`);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setStatusMessage("You must be logged in as a trainer to reset passwords.");
        setResettingClientId(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "admin-generate-client-reset-link",
        {
          body: {
            clientUserId: client.id,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        console.error(error);
        setStatusMessage("Could not generate reset link: " + error.message);
        setResettingClientId(null);
        return;
      }

      if (data?.error) {
        setStatusMessage("Could not generate reset link: " + data.error);
        setResettingClientId(null);
        return;
      }

      if (!data?.resetLink) {
        setStatusMessage("Reset link was not returned by the server.");
        setResettingClientId(null);
        return;
      }

      await navigator.clipboard.writeText(data.resetLink);

      setLastResetLink(data.resetLink);
      setStatusMessage(
        `Password reset link for ${client.full_name} was copied to your clipboard. Send it to the client so they can create a new password.`
      );

      setResettingClientId(null);
    } catch (error) {
      console.error(error);
      setStatusMessage(
        "Something went wrong while generating the reset link. Check the browser console and Supabase function logs."
      );
      setResettingClientId(null);
    }
  }

  async function copyLastResetLink() {
    if (!lastResetLink) return;

    await navigator.clipboard.writeText(lastResetLink);
    setStatusMessage("Reset link copied again.");
  }

  async function deleteClient(clientId: string, clientName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${clientName}? This will remove their CoachSync data and Supabase login account.`
    );

    if (!confirmed) return;

    const secondConfirm = window.confirm(
      "This cannot be undone. Are you absolutely sure?"
    );

    if (!secondConfirm) return;

    setDeletingClientId(clientId);
    setStatusMessage(`Deleting ${clientName}...`);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setStatusMessage("You must be logged in as a trainer to delete clients.");
        setDeletingClientId(null);
        return;
      }

      const response = await fetch("/api/delete-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clientUserId: clientId,
        }),
      });

      let result: { success?: boolean; message?: string; error?: string } = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        setStatusMessage(
          "Could not delete client: " +
            (result.error || `Server returned ${response.status}`)
        );
        setDeletingClientId(null);
        return;
      }

      setClients((currentClients) =>
        currentClients.filter((client) => client.id !== clientId)
      );

      setStatusMessage(
        result.message || `${clientName} was deleted successfully.`
      );

      setDeletingClientId(null);
    } catch (error) {
      console.error(error);
      setStatusMessage(
        "Something went wrong while deleting the client. Check the browser console and Vercel function logs."
      );
      setDeletingClientId(null);
    }
  }

  const filteredClients = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) return clients;

    return clients.filter((client) => {
      return (
        client.full_name?.toLowerCase().includes(search) ||
        client.client_id?.toLowerCase().includes(search) ||
        client.id?.toLowerCase().includes(search)
      );
    });
  }, [clients, searchText]);

  const completedSetupCount = clients.filter(
    (client) => client.setup_complete === true
  ).length;

  const incompleteSetupCount = clients.filter(
    (client) => client.setup_complete === false
  ).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  Trainer Dashboard
                </p>

                <h1 className="mt-3 break-words text-3xl font-bold md:text-4xl">
                  Client List
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  View client profiles, open client details, manage starting
                  info, goals, assigned programs, submitted workouts, and reset
                  client passwords.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={loadClients}
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Refresh
                </button>

                <Link
                  to="/create-client"
                  className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:py-2"
                >
                  Add Client
                </Link>

                <Link
                  to="/trainer"
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-4 md:p-8">
            <StatCard title="Total Clients" value={`${clients.length}`} />

            <StatCard
              title="Setup Complete"
              value={`${completedSetupCount}`}
            />

            <StatCard title="Needs Setup" value={`${incompleteSetupCount}`} />

            <StatCard
              title="Latest Client"
              value={clients[0]?.full_name || "None yet"}
            />
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Search Clients
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Search by name, client ID, or auth UID.
              </p>
            </div>

            <div className="w-full md:max-w-md">
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search clients..."
                className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-6 rounded-2xl border border-sky-100 bg-white p-4 text-sm font-medium leading-6 text-slate-700 shadow-sm">
            <p>{statusMessage}</p>

            {lastResetLink && (
              <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last Generated Reset Link
                </p>

                <p className="mt-2 break-all text-xs text-slate-600">
                  {lastResetLink}
                </p>

                <button
                  type="button"
                  onClick={copyLastResetLink}
                  className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Copy Again
                </button>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <EmptyState
            title="Loading clients..."
            description="Checking Supabase for client profiles."
          />
        ) : clients.length === 0 ? (
          <EmptyState
            title="No clients found"
            description="Click Add Client to create your first real client profile."
          />
        ) : filteredClients.length === 0 ? (
          <EmptyState
            title="No matching clients"
            description="Try searching a different name, client ID, or auth UID."
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredClients.map((client) => {
              const isDeleting = deletingClientId === client.id;
              const isResetting = resettingClientId === client.id;
              const isBusy = isDeleting || isResetting;

              return (
                <div
                  key={client.id}
                  className={`rounded-3xl border border-sky-100 bg-white p-5 shadow-sm transition sm:p-6 ${
                    isBusy
                      ? "opacity-60"
                      : "hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
                  }`}
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
                        👤
                      </div>

                      <h2 className="break-words text-xl font-bold text-slate-900">
                        {client.full_name}
                      </h2>

                      <p className="mt-1 break-words text-sm text-slate-500">
                        Client ID: {client.client_id || "Not set"}
                      </p>
                    </div>

                    <SetupBadge setupComplete={client.setup_complete} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBox
                      label="Created"
                      value={new Date(client.created_at).toLocaleDateString()}
                    />

                    <InfoBox
                      label="Setup"
                      value={
                        client.setup_complete
                          ? "Complete"
                          : "Not completed yet"
                      }
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <p className="text-sm font-medium text-slate-500">
                      Auth UID
                    </p>

                    <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                      {client.id}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link
                      to={`/clients/${client.id}`}
                      className={`rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2 ${
                        isBusy ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      Open Details
                    </Link>

                    <Link
                      to="/create-program"
                      className={`rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:py-2 ${
                        isBusy ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      Add Program
                    </Link>

                    <Link
                      to="/messages"
                      className={`rounded-xl border border-sky-100 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-sky-50 sm:py-2 ${
                        isBusy ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      Message
                    </Link>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => generateClientResetLink(client)}
                      className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2"
                    >
                      {isResetting ? "Generating..." : "Reset Password"}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => deleteClient(client.id, client.full_name)}
                      className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2"
                    >
                      {isDeleting ? "Deleting..." : "Delete Client"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function SetupBadge({ setupComplete }: { setupComplete: boolean | null }) {
  if (setupComplete) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
        Setup Complete
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
      Needs Setup
    </span>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{title}</p>

      <h2 className="mt-2 break-words text-lg font-bold text-slate-900 sm:text-xl">
        {value}
      </h2>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
        👥
      </div>

      <h2 className="text-xl font-bold text-slate-900">{title}</h2>

      <p className="mt-2 text-slate-500">{description}</p>
    </div>
  );
}