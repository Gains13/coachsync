import { Link } from "react-router-dom";

export default function Messages() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="mt-2 text-slate-400">
              Keep communication with clients organized.
            </p>
          </div>

          <Link
            to="/trainer"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            Back to Trainer
          </Link>
        </div>

        <div className="space-y-4">
          <MessageCard
            name="Adam"
            message="Can you send me the plan for this week?"
            time="Today"
          />
          <MessageCard
            name="Suzanne"
            message="My hip felt better after the last session."
            time="Yesterday"
          />
          <MessageCard
            name="Carol"
            message="I’m ready to start the summer program."
            time="2 days ago"
          />
        </div>
      </section>
    </main>
  );
}

function MessageCard({
  name,
  message,
  time,
}: {
  name: string;
  message: string;
  time: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{name}</h2>
        <span className="text-sm text-slate-500">{time}</span>
      </div>
      <p className="text-slate-300">{message}</p>
    </div>
  );
}