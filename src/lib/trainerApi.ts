import { supabase } from "./supabaseClient";

export type TrainerApiResult<T> = {
  data: (T & { error?: string }) | null;
  error: string;
  status: number;
};

// Calls a trainer-only function in /api with the signed-in trainer's token.
export async function trainerPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<TrainerApiResult<T>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { data: null, error: "You must be logged in as a trainer.", status: 401 };
  }

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as T & { error?: string };

    return {
      data,
      error: response.ok ? "" : data.error || `Server returned ${response.status}`,
      status: response.status,
    };
  } catch (error) {
    console.error(error);
    return { data: null, error: "Could not reach the server.", status: 0 };
  }
}
