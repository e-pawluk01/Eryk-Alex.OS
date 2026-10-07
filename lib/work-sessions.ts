import { supabase } from "./supabase";

// In the order the work happens: getting stock, preparing it, making it,
// selling it, then running the business.
export const WORK_TASKS = [
  "Sourcing",
  "Research",
  "Cleaning / Restoration",
  "Photography",
  "Sewing",
  "Listing",
  "Relisting",
  "Packing / Shipping",
  "Content",
  "Strategy",
  "Operations",
  "Development",
  "Admin",
  "Other",
] as const;

// One fixed colour per task, used everywhere the task appears.
export const TASK_COLORS: Record<string, string> = {
  "Listing": "#3987e5",
  "Relisting": "#8fbdf2",
  "Photography": "#d95926",
  "Sourcing": "#199e70",
  "Research": "#2bb3c0",
  "Cleaning / Restoration": "#c98500",
  "Sewing": "#a3c13d",
  "Packing / Shipping": "#d55181",
  "Admin": "#008300",
  "Strategy": "#a24bb5",
  "Operations": "#a87b4f",
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

// "Together": a joint task is logged as one session each, with the exact same
// start time, which is how the two are recognised as a pair at clock-out.
export const partnerOf = (person: string) => (person === "Alex" ? "Eryk" : "Alex");

/** The other person's running session, if they're clocked in. */
export async function openSessionOf(person: string): Promise<WorkSession | null> {
  const { data } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("person", person)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  return (data?.[0] as WorkSession) ?? null;
}

/** The partner's half of a joint session that is still running, if any. */
export async function togetherSessionOf(session: WorkSession): Promise<WorkSession | null> {
  const { data } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("person", partnerOf(session.person))
    .eq("task", session.task)
    .eq("started_at", session.started_at)
    .is("ended_at", null)
    .limit(1);
  return (data?.[0] as WorkSession) ?? null;
}

/** False if the session has already been ended (e.g. by the partner). */
export async function isStillRunning(id: string): Promise<boolean> {
  const { data } = await supabase.from("work_sessions").select("ended_at").eq("id", id).maybeSingle();
  return !!data && data.ended_at === null;
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
  replaceId?: string,
  together = false
): Promise<{ error?: string }> {
  const rowsFor = (who: string) => pieces.map((p) => ({
    person: who,
    task: p.task,
    started_at: p.startedAt.toISOString(),
    ended_at: p.endedAt.toISOString(),
    duration: Math.round((p.endedAt.getTime() - p.startedAt.getTime()) / 1000),
  }));
  const rows = rowsFor(person);

  if (!replaceId) {
    // One multi-row insert: either every piece (for both people, when
    // together) is saved or none is.
    const all = together ? [...rows, ...rowsFor(partnerOf(person))] : rows;
    const { error } = await supabase.from("work_sessions").insert(all);
    if (error) return { error: friendlyError(error.message) };
    notifySessionsChanged();
    return {};
  }

  // Insert the extra pieces first, so a failure leaves the original session
  // (and a running timer) untouched instead of half-saved.
  const [first, ...rest] = rows;
  let insertedIds: string[] = [];
  if (rest.length > 0) {
    const { data, error } = await supabase.from("work_sessions").insert(rest).select("id");
    if (error) return { error: friendlyError(error.message) };
    insertedIds = (data || []).map((r) => r.id);
  }

  const { data, error } = await supabase
    .from("work_sessions")
    .update(first)
    .eq("id", replaceId)
    .select("id");
  if (error || !data || data.length === 0) {
    if (insertedIds.length > 0) {
      await supabase.from("work_sessions").delete().in("id", insertedIds);
    }
    return { error: error ? friendlyError(error.message) : "This session couldn't be updated. It may have been deleted." };
  }

  notifySessionsChanged();
  return {};
}

function friendlyError(message: string) {
  return message.includes("row-level security")
    ? "The database blocked this save (permissions). Nothing was changed."
    : message;
}

export async function deleteSession(id: string): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from("work_sessions")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: friendlyError(error.message) };
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
