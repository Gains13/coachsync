import { Link, useParams } from "react-router-dom";
import ClientDashboard from "./ClientDashboard";

export default function TrainerClientPreview() {
  const { clientUserId } = useParams();

  if (!clientUserId) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black">Client preview unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No client ID was provided for this preview.
          </p>
          <Link
            to="/clients"
            className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700"
          >
            Back to Clients
          </Link>
        </div>
      </main>
    );
  }

  return (
    <ClientDashboard
      previewClientUserId={clientUserId}
      previewMode
    />
  );
}