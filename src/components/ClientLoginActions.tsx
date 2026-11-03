import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { btnGhost, btnPrimary } from "./ui/styles";

type ClientLoginActionsProps = {
  client: { id: string; full_name: string };
  disabled?: boolean;
};

type FunctionResult = {
  error?: string;
  message?: string;
  resetLink?: string;
};

async function invokeTrainerFunction(
  functionName: string,
  clientUserId: string
): Promise<FunctionResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { error: "You must be logged in as a trainer to do this." };
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { clientUserId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    // Non-2xx responses keep the server's real message on the response body.
    const details = await error.context?.json?.().catch(() => null);
    return { error: details?.error || error.message };
  }

  return data || {};
}

export default function ClientLoginActions({
  client,
  disabled = false,
}: ClientLoginActionsProps) {
  const [busyAction, setBusyAction] = useState<"reset" | "reactivate" | null>(
    null
  );
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [resetLink, setResetLink] = useState("");

  function showMessage(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function copyToClipboard(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      return true;
    } catch (error) {
      // Some phones block clipboard access after a network call.
      console.error(error);
      return false;
    }
  }

  async function generateResetLink() {
    setBusyAction("reset");
    setResetLink("");
    showMessage("");

    try {
      const result = await invokeTrainerFunction(
        "admin-generate-client-reset-link",
        client.id
      );

      if (result.error || !result.resetLink) {
        showMessage(
          "Could not create reset link: " +
            (result.error || "no link was returned."),
          true
        );
        return;
      }

      setResetLink(result.resetLink);

      const copied = await copyToClipboard(result.resetLink);
      showMessage(
        copied
          ? `Link copied. Send it to ${client.full_name} to create a new password.`
          : `Link ready. Send it to ${client.full_name} to create a new password.`
      );
    } catch (error) {
      console.error(error);
      showMessage("Something went wrong while creating the reset link.", true);
    } finally {
      setBusyAction(null);
    }
  }

  async function copyLink() {
    const copied = await copyToClipboard(resetLink);
    showMessage(
      copied ? "Link copied." : "Could not copy. Press and hold the link to copy it.",
      !copied
    );
  }

  async function shareLink() {
    try {
      await navigator.share({
        title: "Reset your CoachSync password",
        text: "Use this link to create a new CoachSync password:",
        url: resetLink,
      });
    } catch (error) {
      // Closing the share sheet also rejects, so there's nothing to report.
      console.error(error);
    }
  }

  async function reactivateLogin() {
    const confirmed = window.confirm(
      `Reactivate login for ${client.full_name}? This will clear failed login attempts, remove any temporary lock, and remove suspension.`
    );

    if (!confirmed) return;

    setBusyAction("reactivate");
    setResetLink("");
    showMessage("");

    try {
      const result = await invokeTrainerFunction(
        "admin-reactivate-client-login",
        client.id
      );

      if (result.error) {
        showMessage("Could not reactivate login: " + result.error, true);
        return;
      }

      showMessage(
        result.message || `Login for ${client.full_name} has been reactivated.`
      );
    } catch (error) {
      console.error(error);
      showMessage("Something went wrong while reactivating the login.", true);
    } finally {
      setBusyAction(null);
    }
  }

  const isBusy = disabled || busyAction !== null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generateResetLink}
          disabled={isBusy}
          className={`${btnGhost} h-9 disabled:opacity-50`}
        >
          {busyAction === "reset" ? "Creating link..." : "Reset password"}
        </button>

        <button
          type="button"
          onClick={reactivateLogin}
          disabled={isBusy}
          className={`${btnGhost} h-9 disabled:opacity-50`}
        >
          {busyAction === "reactivate" ? "Reactivating..." : "Reactivate login"}
        </button>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-3 text-sm font-medium leading-6 ${
            isError ? "text-red-700" : "text-ink/80"
          }`}
        >
          {message}
        </p>
      )}

      {resetLink && (
        <div className="mt-3 rounded-xl bg-canvas p-3">
          <p className="text-xs font-semibold text-muted">
            One-time link, expires in 30 minutes
          </p>
          <p className="mt-1 break-all text-xs text-muted">{resetLink}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className={`${btnPrimary} h-9`}
            >
              Copy link
            </button>

            {"share" in navigator && (
              <button
                type="button"
                onClick={shareLink}
                className={`${btnGhost} h-9`}
              >
                Send link
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
