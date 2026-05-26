import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Message = {
  id: string;
  client_user_id: string;
  sender_user_id: string;
  receiver_user_id: string | null;
  message_body: string;
  created_at: string;
  read_at: string | null;
};

export default function Messages() {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"trainer" | "client" | "">("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [clientUserIdForTrainer, setClientUserIdForTrainer] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    setIsLoading(true);
    setStatusMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatusMessage("You must be logged in to view messages.");
      setIsLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      setStatusMessage("Could not load profile.");
      setIsLoading(false);
      return;
    }

    setRole(profile.role);

    let query = supabase
      .from("messages")
      .select("id, client_user_id, sender_user_id, receiver_user_id, message_body, created_at, read_at")
      .order("created_at", { ascending: false });

    if (profile.role === "client") {
      query = query.eq("client_user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      setStatusMessage("Could not load messages: " + error.message);
      setIsLoading(false);
      return;
    }

    setMessages(data || []);
    setIsLoading(false);
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();

    if (!messageBody.trim()) {
      setStatusMessage("Message cannot be empty.");
      return;
    }

    if (!userId || !role) {
      setStatusMessage("User account not found. Please log in again.");
      return;
    }

    setIsSending(true);
    setStatusMessage("Sending message...");

    const targetClientUserId =
      role === "client" ? userId : clientUserIdForTrainer.trim();

    if (!targetClientUserId) {
      setStatusMessage("Trainer replies need a client user ID.");
      setIsSending(false);
      return;
    }

    const { error } = await supabase.from("messages").insert({
      client_user_id: targetClientUserId,
      sender_user_id: userId,
      receiver_user_id: role === "client" ? null : targetClientUserId,
      message_body: messageBody.trim(),
    });

    if (error) {
      setStatusMessage("Message failed: " + error.message);
      setIsSending(false);
      return;
    }

    setMessageBody("");
    setClientUserIdForTrainer("");
    setStatusMessage("Message sent.");
    setIsSending(false);
    loadMessages();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              CoachSync
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">Messages</h1>
            <p className="mt-2 max-w-2xl text-slate-500">
              {role === "client"
                ? "Message your trainer and review your conversation."
                : "Review client messages and keep communication organized."}
            </p>
          </div>

          <Link
            to={role === "client" ? "/client" : "/trainer"}
            className="rounded-xl border border-sky-100 bg-white px-4 py-2 text-center text-sm font-semibold text-blue-600 shadow-sm hover:bg-sky-50"
          >
            Back to Dashboard
          </Link>
        </div>

        <form
          onSubmit={sendMessage}
          className="mb-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6"
        >
          {role === "trainer" && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Client User ID
              </label>
              <input
                value={clientUserIdForTrainer}
                onChange={(event) => setClientUserIdForTrainer(event.target.value)}
                placeholder="Paste client_user_id here"
                className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Message
          </label>

          <textarea
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            placeholder={
              role === "client"
                ? "Message your trainer..."
                : "Reply to the client..."
            }
            rows={4}
            className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />

          {statusMessage && (
            <p className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium text-slate-700">
              {statusMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSending}
            className="mt-4 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSending ? "Sending..." : "Send Message"}
          </button>
        </form>

        <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
          {isLoading ? (
            <p className="text-slate-600">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-slate-600">No messages yet.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-2xl border border-sky-100 bg-sky-50 p-5"
                >
                  <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-slate-900">
                      {message.sender_user_id === userId ? "You" : "Other User"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>

                  <p className="leading-6 text-slate-700">
                    {message.message_body}
                  </p>

                  {role === "trainer" && (
                    <p className="mt-3 break-all text-xs text-slate-500">
                      Client ID: {message.client_user_id}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}