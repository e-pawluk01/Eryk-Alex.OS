export type ContextType = 
  | "Eryk"
  | "Alex"
  | "Reselling"
  | "Drink idea";

export interface Goal {
  id: string;
  title: string;
  year: number;
  context: string;
  status: "active" | "completed";
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  parent_id: string | null;
  context: ContextType;
  scheduled_date: string | null; // ISO Date string (YYYY-MM-DD)
  due_date: string | null;
  status: "todo" | "done";
  folder_id: string | null;
  project?: string | null;
  color?: string | null;
  domain?: "WORK" | "STUDY" | null;
  track_progress?: boolean;
  progress?: number;
  created_at: string;
  subTasks?: Task[];
  is_joint?: boolean;
  tag_id?: string | null;
  is_daily?: boolean;
}

export interface Topic {
  id: string;
  title: string;
  context: ContextType;
  tag: string;
  color: string;
  repetition: number;
  interval: number;
  ease_factor: number;
  next_review_date: string; // "yyyy-MM-dd"
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  event_date: string; // ISO Date string (YYYY-MM-DD)
  event_time: string | null; // e.g. "14:30"
  context: ContextType;
  domain?: "WORK" | "STUDY" | null;
  tag_id?: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  context: ContextType;
}

// Study: each person's own modules and deadlines (Work stays shared).
export interface StudyModule {
  id: string;
  person: ContextType;
  name: string;
  color: string; // hex
  kind: "course" | "self";
  created_at: string;
}

export interface StudyDeadline {
  id: string;
  person: ContextType;
  module_id: string;
  title: string;
  type: string;
  opens_on: string | null; // "yyyy-MM-dd": when work can start, if it has a window
  cutoff_on: string; // "yyyy-MM-dd"
  cutoff_time: string | null; // "HH:mm[:ss]"
  done: boolean;
  score: string | null;
  note: string | null;
  // How far you are: by parts ("2 of 5") or by percentage. Null until first set.
  progress_mode: "parts" | "percent" | null;
  progress_done: number | null;
  progress_total: number | null;
  progress_pct: number | null;
  created_at: string;
}

export interface StudyMaterial {
  id: string;
  person: ContextType;
  module_id: string;
  title: string;
  unit: string | null; // "pages" | "chapters" | "lectures" | … ; null when there's no total
  total: number | null;
  current: number; // where you're up to
  pinned: boolean; // show its bar on Study home
  finish_by: string | null; // "yyyy-MM-dd"
  created_at: string;
}
