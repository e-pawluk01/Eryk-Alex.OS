"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Folder, Task } from "@/lib/types";
import { useGlobalContext } from "@/components/global-context";
import { TaskItem } from "@/components/task-item";
import { Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TasksPage() {
  const { currentContext } = useGlobalContext();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [foldersRes, tasksRes] = await Promise.all([
        supabase.from("folders").select("*").order("name", { ascending: true }),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      ]);

      if (foldersRes.data) {
        setFolders(foldersRes.data as Folder[]);
        // Default select first folder of context if available
        const defaultFolder = foldersRes.data.find(f => currentContext === "All" || f.context === currentContext);
        if (defaultFolder) setSelectedFolderId(defaultFolder.id);
      }
      if (tasksRes.data) setTasks(tasksRes.data as Task[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleToggleStatus = async (id: string, newStatus: "todo" | "done") => {
    setTasks(prev => 
      prev.map(t => t.id === id ? { ...t, status: newStatus } : t)
    );
    await supabase.from("tasks").update({ status: newStatus }).eq("id", id);
  };

  const filteredFolders = useMemo(() => {
    return folders.filter(f => currentContext === "All" || f.context === currentContext);
  }, [folders, currentContext]);

  // Build task tree for the selected folder
  const folderTaskTree = useMemo(() => {
    const flatTasks = tasks.filter(t => t.folder_id === selectedFolderId);
    const taskMap = new Map<string, Task>(flatTasks.map(t => [t.id, { ...t, subTasks: [] }]));
    const roots: Task[] = [];

    taskMap.forEach(task => {
      if (task.parent_id && taskMap.has(task.parent_id)) {
        taskMap.get(task.parent_id)!.subTasks!.push(task);
      } else {
        roots.push(task);
      }
    });
    return roots;
  }, [tasks, selectedFolderId]);

  if (loading) {
    return <div className="animate-pulse flex h-[80vh] gap-8 mt-4">
      <div className="w-1/4 h-full bg-secondary rounded-lg"></div>
      <div className="w-3/4 h-full bg-secondary rounded-lg"></div>
    </div>;
  }

  return (
    <div className="flex h-[80vh] gap-8 mt-4">
      
      {/* Left Panel: Folders */}
      <aside className="w-1/3 md:w-1/4 flex flex-col gap-4 border-r border-border pr-4 overflow-y-auto">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground pb-2">Folders</h2>
        {filteredFolders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No folders found.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredFolders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm text-left",
                  selectedFolderId === folder.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <FolderIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Right Panel: Tasks */}
      <section className="flex-1 flex flex-col gap-4 overflow-y-auto pl-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground pb-2">Tasks</h2>
        <div className="bg-card border border-border rounded-lg p-2 md:p-6 min-h-[50vh]">
          {!selectedFolderId ? (
            <p className="text-sm text-muted-foreground p-4">Select a folder to view tasks.</p>
          ) : folderTaskTree.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No tasks in this folder.</p>
          ) : (
            <div className="flex flex-col">
              {folderTaskTree.map(task => (
                <TaskItem key={task.id} task={task} onToggleStatus={handleToggleStatus} />
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
