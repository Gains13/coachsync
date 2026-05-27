import { useEffect, useMemo, useState } from "react";
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

type ClientProfile = {
  id: string;
  full_name: string;
  client_id: string;
};

type Role = "trainer" | "client" | "";

export default function Messages() {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [searchText, setSearchText] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  async function markClientMessagesAsRead(currentUserId: string) {
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("client_user_id", currentUserId)
      .eq("receiver_user_id", currentUserId)
      .is("read_at", null);

    if (error) {
      console.error("Could not mark messages as read:", error);
    }
  }

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

    const userRole = profile.role as Role;
    setRole(userRole);

    if (userRole === "trainer") {
      const { data: clientData, error: clientError } = await supabase
        .from("profiles")
        .select("id, full_name, client_id")
        .eq("role", "client")
        .order("full_name", { ascending: true });

      if (clientError) {
        console.error(clientError);
        setStatusMessage("Could not load clients: " + clientError.message);
      } else {
        setClients((clientData || []) as ClientProfile[]);
      }
    }

    let query = supabase
      .from("messages")
      .select(
        "id, client_user_id, sender_user_id, receiver_user_id, message_body, created_at, read_at"
      )
      .order("created_at", { ascending: false });

    if (userRole === "client") {
      query = query.eq("client_user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      setStatusMessage("Could not load messages: " + error.message);
      setIsLoading(false);
      return;
    }

    setMessages((data || []) as Message[]);

    if (userRole === "client") {
      await markClientMessagesAsRead(user.id);

      const updatedMessages = (data || []).map((message) => {
        if (
          message.client_user_id === user.id &&
          message.receiver_user_id === user.id &&
          message.read_at === null
        ) {
          return {
            ...message,
            read_at: new Date().toISOString(),
          };
        }

        return message;
      });

      setMessages(updatedMessages as Message[]);
    }

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

    const targetClientUserId = role === "client" ? userId : selectedClientId;

    if (!targetClientUserId) {
      setStatusMessage("Please select a client before sending a message.");
      return;
    }

    setIsSending(true);
    setStatusMessage("Sending message...");

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
    setStatusMessage("Message sent.");
    setIsSending(false);
    await loadMessages();
  }

  function getClient(clientUserId: string) {
    return clients.find((client) => client.id === clientUserId) || null;
  }

  function getClientName(clientUserId: string) {
    const client = getClient(clientUserId);

    if (!client) return "Unknown Client";

    return client.full_name || client.client_id || "Unknown Client";
  }

  function getClientId(clientUserId: string) {
    const client = getClient(clientUserId);

    return client?.client_id || "Not set";
  }

  function getSenderLabel(message: Message) {
    if (message.sender_user_id === userId) return "You";

    if (role === "trainer") {
      return getClientName(message.client_user_id);
    }

    return "Trainer";
  }

  const selectedClient = selectedClientId
    ? clients.find((client) => client.id === selectedClientId)
    : null;

  const filteredMessages = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) return messages;

    return messages.filter((message) => {
      const clientName = getClientName(message.client_user_id).toLowerCase();
      const clientId = getClientId(message.client_user_id).toLowerCase();
      const body = message.message_body.toLowerCase();

      return (
        clientName.includes(search) ||
        clientId.includes(search) ||
        body.includes(search)
      );
    });
  }, [messages, clients, searchText]);

  const clientGroups = useMemo(() => {
    const grouped = new Map<string, Message[]>();

    filteredMessages.forEach((message) => {
      const existing = grouped.get(message.client_user_id) || [];
      grouped.set(message.client_user_id, [...existing, message]);
    });

    return Array.from(grouped.entries())
      .map(([clientUserId, groupMessages]) => {
        const sortedMessages = [...groupMessages].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

        return {
          clientUserId,
          client: getClient(clientUserId),
          messages: sortedMessages,
          latestMessage: sortedMessages[0],
        };
      })
      .sort((a, b) => {
        const aDate = a.latestMessage
          ? new Date(a.latestMessage.created_at).getTime()
          : 0;

        const bDate = b.latestMessage
          ? new Date(b.latestMessage.created_at).getTime()
          : 0;

        return bDate - aDate;
      });
  }, [filteredMessages, clients]);

  const totalMessages = messages.length;
  const totalClientsMessaged = new Set(
    messages.map((message) => message.client_user_id)
  ).size;

  const latestMessageDate =
    messages.length > 0
      ? new Date(messages[0].created_at).toLocaleDateString()
      : "None yet";

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900">
      <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
          <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-6 text-white sm:px-6 sm:py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
                  CoachSync Messages
                </p>

                <h1 className="mt-3 break-words text-3xl font-bold md:text-4xl">
                  Messages
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                  {role === "client"
                    ? "Read updates from your trainer and send a reply."
                    : "Review client messages, reply by client, and keep communication organized."}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={loadMessages}
                  className="w-full rounded-xl bg-white/15 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 sm:w-auto sm:py-2"
                >
                  Refresh
                </button>

                <Link
                  to={role === "client" ? "/client" : "/trainer"}
                  className="w-full rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:py-2"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-3 md:p-8">
            <SummaryCard title="Messages" value={`${totalMessages}`} />

            <SummaryCard
              title={role === "client" ? "Conversation" : "Clients Messaged"}
              value={role === "client" ? "Trainer" : `${totalClientsMessaged}`}
            />

            <SummaryCard title="Latest" value={latestMessageDate} />
          </div>
        </div>

        {role === "client" ? (
          <>
            <MessageHistorySection
              role={role}
              isLoading={isLoading}
              messages={messages}
              filteredMessages={filteredMessages}
              clientGroups={clientGroups}
              userId={userId}
              getSenderLabel={getSenderLabel}
              searchText={searchText}
              setSearchText={setSearchText}
              getClientName={getClientName}
              getClientId={getClientId}
            />

            <SendMessageForm
              role={role}
              clients={clients}
              selectedClientId={selectedClientId}
              setSelectedClientId={setSelectedClientId}
              selectedClient={selectedClient}
              messageBody={messageBody}
              setMessageBody={setMessageBody}
              statusMessage={statusMessage}
              isSending={isSending}
              sendMessage={sendMessage}
            />
          </>
        ) : (
          <>
            <SendMessageForm
              role={role}
              clients={clients}
              selectedClientId={selectedClientId}
              setSelectedClientId={setSelectedClientId}
              selectedClient={selectedClient}
              messageBody={messageBody}
              setMessageBody={setMessageBody}
              statusMessage={statusMessage}
              isSending={isSending}
              sendMessage={sendMessage}
            />

            <MessageHistorySection
              role={role}
              isLoading={isLoading}
              messages={messages}
              filteredMessages={filteredMessages}
              clientGroups={clientGroups}
              userId={userId}
              getSenderLabel={getSenderLabel}
              searchText={searchText}
              setSearchText={setSearchText}
              getClientName={getClientName}
              getClientId={getClientId}
              setSelectedClientId={setSelectedClientId}
            />
          </>
        )}
      </section>
    </main>
  );
}

function SendMessageForm({
  role,
  clients,
  selectedClientId,
  setSelectedClientId,
  selectedClient,
  messageBody,
  setMessageBody,
  statusMessage,
  isSending,
  sendMessage,
}: {
  role: Role;
  clients: ClientProfile[];
  selectedClientId: string;
  setSelectedClientId: (value: string) => void;
  selectedClient: ClientProfile | null | undefined;
  messageBody: string;
  setMessageBody: (value: string) => void;
  statusMessage: string;
  isSending: boolean;
  sendMessage: (event: React.FormEvent) => void;
}) {
  return (
    <form
      onSubmit={sendMessage}
      className="mb-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-900">Send Message</h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {role === "client"
            ? "Send a reply directly to your trainer."
            : "Choose a client, then send a reply or follow-up message."}
        </p>
      </div>

      {role === "trainer" && (
        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Client
          </label>

          <select
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
            className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name} — {client.client_id}
              </option>
            ))}
          </select>

          {selectedClient && (
            <p className="mt-2 text-sm text-slate-500">
              Sending to:{" "}
              <span className="font-semibold text-slate-700">
                {selectedClient.full_name}
              </span>
            </p>
          )}
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
            ? "Reply to your trainer..."
            : "Reply to the client..."
        }
        rows={4}
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />

      {statusMessage && (
        <p className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-medium leading-6 text-slate-700">
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
  );
}

function MessageHistorySection({
  role,
  isLoading,
  messages,
  filteredMessages,
  clientGroups,
  userId,
  getSenderLabel,
  searchText,
  setSearchText,
  getClientName,
  getClientId,
  setSelectedClientId,
}: {
  role: Role;
  isLoading: boolean;
  messages: Message[];
  filteredMessages: Message[];
  clientGroups: {
    clientUserId: string;
    client: ClientProfile | null;
    messages: Message[];
    latestMessage: Message;
  }[];
  userId: string;
  getSenderLabel: (message: Message) => string;
  searchText: string;
  setSearchText: (value: string) => void;
  getClientName: (clientUserId: string) => string;
  getClientId: (clientUserId: string) => string;
  setSelectedClientId?: (value: string) => void;
}) {
  return (
    <>
      <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Message History
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              {role === "client"
                ? "Your conversation with your trainer."
                : "Search by client name, client ID, or message content."}
            </p>
          </div>

          {role === "trainer" && (
            <div className="w-full md:max-w-md">
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search messages..."
                className="w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <EmptyState
          title="Loading messages..."
          description="Checking Supabase for messages."
        />
      ) : messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description={
            role === "client"
              ? "You do not have any messages from your trainer yet."
              : "Client messages will appear here."
          }
        />
      ) : role === "client" ? (
        <ClientConversation
          messages={filteredMessages}
          userId={userId}
          getSenderLabel={getSenderLabel}
        />
      ) : clientGroups.length === 0 ? (
        <EmptyState
          title="No matching messages"
          description="Try searching a different client name, client ID, or message."
        />
      ) : (
        <div className="space-y-6">
          {clientGroups.map((group) => (
            <div
              key={group.clientUserId}
              className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm"
            >
              <div className="border-b border-sky-100 bg-sky-50 p-5 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {getClientName(group.clientUserId)}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Client ID: {getClientId(group.clientUserId)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        if (setSelectedClientId) {
                          setSelectedClientId(group.clientUserId);
                        }

                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2"
                    >
                      Reply
                    </button>

                    <Link
                      to={`/clients/${group.clientUserId}`}
                      className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:py-2"
                    >
                      View Client
                    </Link>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                {group.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    userId={userId}
                    senderLabel={getSenderLabel(message)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ClientConversation({
  messages,
  userId,
  getSenderLabel,
}: {
  messages: Message[];
  userId: string;
  getSenderLabel: (message: Message) => string;
}) {
  const sortedMessages = [...messages].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="space-y-4">
        {sortedMessages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            userId={userId}
            senderLabel={getSenderLabel(message)}
          />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  userId,
  senderLabel,
}: {
  message: Message;
  userId: string;
  senderLabel: string;
}) {
  const sentByMe = message.sender_user_id === userId;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        sentByMe
          ? "border-blue-100 bg-blue-50"
          : "border-sky-100 bg-sky-50"
      }`}
    >
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold text-slate-900">{senderLabel}</p>

        <p className="text-sm text-slate-500">
          {new Date(message.created_at).toLocaleString()}
        </p>
      </div>

      <p className="whitespace-pre-wrap leading-6 text-slate-700">
        {message.message_body}
      </p>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:p-5">
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{title}</p>

      <h2 className="mt-2 break-words text-lg font-bold text-slate-900 sm:text-xl">
        {value}
      </h2>
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
    <div className="mb-6 rounded-3xl border border-sky-100 bg-white p-8 shadow-sm">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl ring-1 ring-sky-100">
        💬
      </div>

      <h2 className="text-xl font-bold text-slate-900">{title}</h2>

      <p className="mt-2 text-slate-500">{description}</p>
    </div>
  );
}