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
  domain?: "WORK" | "STUDY" | "CONTENT" | null;
  track_progress?: boolean;
  progress?: number;
  kanban_column?: "idea" | "scripting" | "filming" | "editing" | null;
  created_at: string;
  subTasks?: Task[];
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

export interface Video {
  id: string;
  title: string;
  context: ContextType;
  tag: string;
  color: string;
  stage: "idea" | "scripting" | "filming" | "editing" | "subtitles" | "uploaded";
  scheduled_date: string; // "yyyy-MM-dd"
  shorts_target: number;
  type?: "long" | "short";
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  event_date: string; // ISO Date string (YYYY-MM-DD)
  event_time: string | null; // e.g. "14:30"
  context: ContextType;
  domain?: "WORK" | "STUDY" | "CONTENT" | null;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  context: ContextType;
}
