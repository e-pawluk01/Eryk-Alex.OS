"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Goal, Task } from "@/lib/types";
import { useGlobalContext } from "@/components/global-context";
import { ContextTag } from "@/components/ui/context-tag";
import { TaskItem } from "@/components/task-item";
import { isToday, isTomorrow, isAfter, startOfDay } from "date-fns";

export default function Home() {
  const { currentContext } = useGlobalContext();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [goalsRes, tasksRes] = await Promise.all([
        supabase.from("goals").select("*").order("year", { ascending: false }),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      ]);

      if (goalsRes.data) setGoals(goalsRes.data as Goal[]);
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

  const filteredGoals = useMemo(() => {
    return goals.filter(g => currentContext === "All" || g.context === currentContext);
  }, [goals, currentContext]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => currentContext === "All" || t.context === currentContext);
  }, [tasks, currentContext]);

  // Build task tree (for today's tasks)
  const buildTaskTree = (flatTasks: Task[]): Task[] => {
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
  };

  const todayStr = startOfDay(new Date()).toISOString();

  // Kanban tasks (flat list, only parents or independent tasks, or all?)
  // Usually Kanban shows top-level tasks.
  const topLevelTasks = filteredTasks.filter(t => !t.parent_id);

  const todayTasks = topLevelTasks.filter(t => t.scheduled_date && isToday(new Date(t.scheduled_date)));
  const tomorrowTasks = topLevelTasks.filter(t => t.scheduled_date && isTomorrow(new Date(t.scheduled_date)));
  const laterTasks = topLevelTasks.filter(t => t.scheduled_date && isAfter(startOfDay(new Date(t.scheduled_date)), startOfDay(new Date(todayStr)) ) && !isTomorrow(new Date(t.scheduled_date)));

  // Build tree only for today tasks (including their subtasks even if subtasks have no scheduled_date or different)
  // For the MVP, we assume subtasks are grouped under their parent's date.
  const todayTaskTree = buildTaskTree(filteredTasks).filter(t => 
    t.scheduled_date && isToday(new Date(t.scheduled_date))
  );

  if (loading) {
    return <div className="animate-pulse flex flex-col gap-12 mt-8">
      <div className="h-32 bg-secondary rounded-lg"></div>
      <div className="h-64 bg-secondary rounded-lg"></div>
    </div>;
  }

  return (
    <div className="flex flex-col gap-12 mt-4 pb-20">
      
      {/* GOALS SECTION */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2">Goals</h2>
        {filteredGoals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals found for this context.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredGoals.map(goal => (
              <div key={goal.id} className="bg-card border border-border p-4 rounded-lg flex flex-col gap-3 justify-between group hover:border-primary/20 transition-colors">
                <h3 className="font-medium text-foreground">{goal.title}</h3>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{goal.year}</span>
                  <ContextTag context={goal.context} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* KANBAN SECTION */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2">Kanban</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="flex flex-col gap-3 bg-card border border-border rounded-lg p-4 h-min min-h-[200px]">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Today</h3>
            {todayTasks.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Nothing scheduled</p>}
            {todayTasks.map(task => (
              <div key={task.id} className="bg-background border border-border p-3 rounded-md text-sm">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={task.status === "done" ? "line-through text-muted-foreground" : ""}>{task.title}</span>
                  <CustomCheckbox checked={task.status === "done"} onChange={(c) => handleToggleStatus(task.id, c ? "done" : "todo")} />
                </div>
                <ContextTag context={task.context} />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 bg-card border border-border rounded-lg p-4 h-min min-h-[200px]">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Tomorrow</h3>
            {tomorrowTasks.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Nothing scheduled</p>}
            {tomorrowTasks.map(task => (
              <div key={task.id} className="bg-background border border-border p-3 rounded-md text-sm">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={task.status === "done" ? "line-through text-muted-foreground" : ""}>{task.title}</span>
                  <CustomCheckbox checked={task.status === "done"} onChange={(c) => handleToggleStatus(task.id, c ? "done" : "todo")} />
                </div>
                <ContextTag context={task.context} />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 bg-card border border-border rounded-lg p-4 h-min min-h-[200px]">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Later</h3>
            {laterTasks.length === 0 && <p className="text-xs text-muted-foreground/50 italic">Nothing scheduled</p>}
            {laterTasks.map(task => (
              <div key={task.id} className="bg-background border border-border p-3 rounded-md text-sm">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={task.status === "done" ? "line-through text-muted-foreground" : ""}>{task.title}</span>
                  <CustomCheckbox checked={task.status === "done"} onChange={(c) => handleToggleStatus(task.id, c ? "done" : "todo")} />
                </div>
                <ContextTag context={task.context} />
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* TODAY'S TASKS LIST SECTION (Nested) */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2">Today's Focus</h2>
        <div className="bg-card border border-border rounded-lg p-2 md:p-6">
          {todayTaskTree.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No tasks in focus for today.</p>
          ) : (
            <div className="flex flex-col">
              {todayTaskTree.map(task => (
                <TaskItem key={task.id} task={task} onToggleStatus={handleToggleStatus} />
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
