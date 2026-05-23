import { Link } from "react-router-dom";
import { clients } from "../data/clients";

export default function ClientProgress() {
  const clientId = localStorage.getItem("coachsync-client-id");
  const client = clients.find((person) => person.id === clientId);

  if (!client) {
    return (
      <PageShell title="Progress" subtitle="Client not found.">
        <Link to="/" className="font-semibold text-blue-600">
          Back to login
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Progress Overview"
      subtitle="Track your progress and improvement trends."
    >
      <div className="space-y-4">
        {client.progressData.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-sky-100 bg-sky-50 p-5"
          >
            <div className="mb-3 flex justify-between text-sm">
              <span className="font-semibold text-slate-700">
                {item.label}
              </span>
              <span className="text-slate-500">
                {item.weight > 0 ? `${item.weight} lbs` : "No data"}
              </span>
            </div>

            <div className="h-3 rounded-full bg-white">
              <div
                className="h-3 rounded-full bg-blue-600"
                style={{ width: item.weight > 0 ? "70%" : "10%" }}
              />
            </div>
          </div>
        ))}
      </div>
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
      <section className="mx-auto max-w-6xl px-6 py-10">
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

        <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
          {children}
        </div>
      </section>
    </main>
  );
}