import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
            CoachSync
          </p>

          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
            Training programs, progress tracking, and client communication in
            one place.
          </h1>

          <p className="mb-8 text-lg leading-8 text-slate-300">
            CoachSync helps trainers manage client assessments, workout
            programs, session notes, progress history, and messages from one
            simple dashboard.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              to="/client"
              className="rounded-xl bg-blue-500 px-6 py-3 text-center font-semibold text-white transition hover:bg-blue-600"
            >
              Client Dashboard
            </Link>

            <Link
              to="/trainer"
              className="rounded-xl border border-slate-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
            >
              Trainer Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-3 text-xl font-semibold">Programs</h2>
            <p className="text-slate-400">
              Build structured workout plans for each client and keep everything
              organized.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-3 text-xl font-semibold">Progress</h2>
            <p className="text-slate-400">
              Track assessments, workout history, completed sessions, and client
              improvements.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-3 text-xl font-semibold">Messages</h2>
            <p className="text-slate-400">
              Keep trainer-client communication connected to the training plan.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}