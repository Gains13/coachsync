import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import TrainerLayout from "../components/TrainerLayout";
import PageHeader from "../components/ui/PageHeader";
import { btnGhost, btnPrimary, card } from "../components/ui/styles";

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
  const [resettingClientId, setResettingClientId] = useState<string | null>(
    null
  );
  const [reactivatingClientId, setReactivatingClientId] = useState<
    string | null
  >(null);
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

  async function reactivateClientLogin(client: ClientProfile) {
    const confirmed = window.confirm(
      `Reactivate login for ${client.full_name}? This will clear failed login attempts, remove any temporary lock, and remove suspension.`
    );

    if (!confirmed) return;

    setReactivatingClientId(client.id);
    setStatusMessage(`Reactivating login for ${client.full_name}...`);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setStatusMessage(
          "You must be logged in as a trainer to reactivate client logins."
        );
        setReactivatingClientId(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "admin-reactivate-client-login",
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
        setStatusMessage("Could not reactivate login: " + error.message);
        setReactivatingClientId(null);
        return;
      }

      if (data?.error) {
        setStatusMessage("Could not reactivate login: " + data.error);
        setReactivatingClientId(null);
        return;
      }

      setStatusMessage(
        data?.message || `Login for ${client.full_name} has been reactivated.`
      );

      setReactivatingClientId(null);
    } catch (error) {
      console.error(error);
      setStatusMessage(
        "Something went wrong while reactivating the client login. Check the browser console and Supabase function logs."
      );
      setReactivatingClientId(null);
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
    <TrainerLayout>
      <PageHeader
        eyebrow="Roster"
        title="Clients"
        actions={
          <>
            <button type="button" onClick={loadClients} className={btnGhost}>
              Refresh
            </button>
            <Link to="/create-client" className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Add client
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Total clients" value={`${clients.length}`} />
        <StatCard title="Setup complete" value={`${completedSetupCount}`} />
        <StatCard
          title="Needs setup"
          value={`${incompleteSetupCount}`}
          warn={incompleteSetupCount > 0}
        />
        <StatCard
          title="Latest client"
          value={clients[0]?.full_name || "None yet"}
          small
        />
      </div>

      {statusMessage && (
        <div className="mb-4 rounded-2xl border border-line bg-white p-4 text-sm leading-6 text-ink/80">
          <p>{statusMessage}</p>

          {lastResetLink && (
            <div className="mt-3 rounded-xl bg-canvas p-3">
              <p className="text-xs font-semibold text-muted">
                Last generated reset link
              </p>
              <p className="mt-1 break-all text-xs text-muted">{lastResetLink}</p>
              <button
                type="button"
                onClick={copyLastResetLink}
                className={`${btnPrimary} mt-3 h-9`}
              >
                Copy again
              </button>
            </div>
          )}
        </div>
      )}

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="text-lg font-bold">All clients</h2>
          <label className="relative w-full sm:max-w-xs">
            <span className="sr-only">Search clients</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by name, client ID or auth UID..."
              className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm outline-none placeholder:text-muted focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
            />
          </label>
        </div>

        {isLoading ? (
          <EmptyState
            title="Loading clients..."
            description="Checking Supabase for client profiles."
          />
        ) : clients.length === 0 ? (
          <EmptyState
            title="No clients found"
            description="Click Add client to create your first real client profile."
          />
        ) : filteredClients.length === 0 ? (
          <EmptyState
            title="No matching clients"
            description="Try searching a different name, client ID, or auth UID."
          />
        ) : (
          <ul>
            {filteredClients.map((client) => {
              const isDeleting = deletingClientId === client.id;
              const isResetting = resettingClientId === client.id;
              const isReactivating = reactivatingClientId === client.id;
              const isBusy = isDeleting || isResetting || isReactivating;

              return (
                <li
                  key={client.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-4 py-4 sm:px-6 ${
                    isBusy ? "opacity-60" : ""
                  }`}
                >
                  <Link
                    to={`/clients/${client.id}`}
                    className="flex min-w-[220px] flex-1 items-center gap-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                      {getInitials(client.full_name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {client.full_name}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {client.client_id || "No client ID"} · Added{" "}
                        {new Date(client.created_at).toLocaleDateString()}
                      </span>
                    </span>
                  </Link>

                  <SetupBadge setupComplete={client.setup_complete} />

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/clients/${client.id}`}
                      className={`${btnGhost} h-9 ${isBusy ? "pointer-events-none" : ""}`}
                    >
                      Open
                    </Link>
                    <Link
                      to="/messages"
                      className={`${btnGhost} h-9 ${isBusy ? "pointer-events-none" : ""}`}
                    >
                      Message
                    </Link>

                    <details className="relative">
                      <summary
                        aria-label={`More actions for ${client.full_name}`}
                        className={`${btnGhost} h-9 w-9 cursor-pointer list-none px-0 [&::-webkit-details-marker]:hidden`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_8px_30px_rgba(15,20,25,0.12)]">
                        <Link
                          to="/create-program"
                          className="block px-4 py-2.5 text-sm hover:bg-canvas"
                        >
                          Add program
                        </Link>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => generateClientResetLink(client)}
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-canvas disabled:opacity-50"
                        >
                          {isResetting ? "Generating..." : "Reset password"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => reactivateClientLogin(client)}
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-canvas disabled:opacity-50"
                        >
                          {isReactivating ? "Reactivating..." : "Reactivate login"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => deleteClient(client.id, client.full_name)}
                          className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting..." : "Delete client"}
                        </button>
                      </div>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </TrainerLayout>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 0) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SetupBadge({ setupComplete }: { setupComplete: boolean | null }) {
  if (setupComplete) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Setup complete
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
      Needs setup
    </span>
  );
}

function StatCard({
  title,
  value,
  warn = false,
  small = false,
}: {
  title: string;
  value: string;
  warn?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border p-4 sm:p-5 ${
        warn ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-white"
      }`}
    >
      <p className={`text-sm ${warn ? "" : "text-muted"}`}>{title}</p>
      <p
        className={`mt-1 break-words font-display font-bold ${
          small ? "text-lg" : "text-[28px] leading-tight"
        }`}
      >
        {value}
      </p>
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
    <div className="border-t border-line px-6 py-10 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}
