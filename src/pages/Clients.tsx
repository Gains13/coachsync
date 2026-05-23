import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
  created_at: string;
};

export default function Clients() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, client_id, created_at")
      .eq("role", "client")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setIsLoading(false);
      return;
    }

    setClients(data || []);
    setIsLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-8 text-white md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-100">
                  Trainer Dashboard
                </p>

                <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                  Client List
                </h1>

                <p className="mt-3 max-w-2xl text-blue-50">
                  View client profiles, open client details, and manage their
                  assigned programs.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={loadClients}
                  className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
                >
                  Refresh
                </button>

                <Link
                  to="/create-client"
                  className="rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Add Client
                </Link>

                <Link
                  to="/trainer"
                  className="rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
                >
                  Back to Trainer
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
            <StatCard title="Total Clients" value={`${clients.length}`} />

            <StatCard
              title="Latest Client"
              value={clients[0]?.full_name || "None yet"}
            />

            <StatCard title="Source" value="Supabase" />
          </div>
        </div>

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
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {clients.map((client) => (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="group block rounded-3xl border border-sky-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
                      👤
                    </div>

                    <h2 className="text-xl font-bold text-slate-900">
                      {client.full_name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Client ID: {client.client_id}
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    Active
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoBox
                    label="Created"
                    value={new Date(client.created_at).toLocaleDateString()}
                  />

                  <InfoBox label="Profile" value="Open details →" />
                </div>

                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-sm font-medium text-slate-500">
                    Auth UID
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                    {client.id}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h2 className="mt-2 break-words text-xl font-bold text-slate-900">
        {value}
      </h2>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
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