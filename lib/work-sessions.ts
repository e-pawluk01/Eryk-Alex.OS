import { supabase } from "./supabase";

export const WORK_TASKS = [
  "Development",
  "Content",
  "Sourcing",
  "Cleaning / Restoration",
  "Photography",
  "Listing",
  "Packing / Shipping",
  "Admin",
  "Other",
] as const;

// One fixed colour per task, used everywhere the task appears.
export const TASK_COLORS: Record<string, string> = {
  "Listing": "#3987e5",
  "Photography": "#d95926",
  "Sourcing": "#199e70",
  "Cleaning / Restoration": "#c98500",
  "Packing / Shipping": "#d55181",
  "Admin": "#008300",
  "Content": "#9085e9",
  "Development": "#e66767",
  "Other": "#555553",
};

export const PERSON_COLORS: Record<string, string> = {
  Eryk: "#3987e5",
  Alex: "#d95926",
};

export function taskColor(task: string) {
  return TASK_COLORS[task] ?? TASK_COLORS.Other;
}

export interface WorkSession {
  id: string;
  person: string;
  task: string;
  started_at: string;
  ended_at: string | null;
  duration: number | null; // seconds
}

// Fired after any session is saved or deleted so open views can refetch.
export const SESSIONS_CHANGED_EVENT = "work-sessions-changed";

export function notifySessionsChanged() {
  window.dispatchEvent(new Event(SESSIONS_CHANGED_EVENT));
}

export interface SessionPiece {
  task: string;
  startedAt: Date;
  endedAt: Date;
}

/**
 * Save one worked stretch, possibly split across several tasks.
 * With `replaceId`, the first piece overwrites that row (clock-out / edit)
 * and any extra pieces are inserted as new rows alongside it.
 */
export async function saveSessionPieces(
  person: string,
  pieces: SessionPiece[],
  replaceId?: string
): Promise<{ error?: string }> {
  const rows = pieces.map((p) => ({
    person,
    task: p.task,
    started_at: p.startedAt.toISOString(),
    ended_at: p.endedAt.toISOString(),
    duration: Math.round((p.endedAt.getTime() - p.startedAt.getTime()) / 1000),
  }));

  let toInsert = rows;
  if (replaceId) {
    const [first, ...rest] = rows;
    const { data, error } = await supabase
      .from("work_sessions")
      .update(first)
      .eq("id", replaceId)
      .select("id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "This session couldn't be updated. It may have been deleted." };
    toInsert = rest;
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("work_sessions").insert(toInsert);
    if (error) return { error: error.message };
  }

  notifySessionsChanged();
  return {};
}

export async function deleteSession(id: string): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from("work_sessions")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  // RLS silently skips rows it won't let us delete, so check something went.
  if (!data || data.length === 0) return { error: "The database didn't allow this session to be deleted." };
  notifySessionsChanged();
  return {};
}

export function formatMinutes(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}
