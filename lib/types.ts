export type ContextType = 
  | "Study (Person A)"
  | "Study (Person B)"
  | "Business 1"
  | "Business 2";

export interface Goal {
  id: string;
  title: string;
  context: ContextType;
  year: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  parent_id: string | null;
  context: ContextType;
  scheduled_date: string | null; // ISO Date string (YYYY-MM-DD)
  status: "todo" | "done";
  folder_id: string | null;
  created_at: string;
  subTasks?: Task[];
}

export interface Folder {
  id: string;
  name: string;
  context: ContextType;
}
