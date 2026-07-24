"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Goal, Task } from "@/lib/types";
import { useGlobalContext } from "@/components/global-context";
import { ContextTag } from "@/components/ui/context-tag";
import { TaskItem } from "@/components/task-item";
import { TaskDetailsPanel } from "@/components/task-details-panel";
import { isToday, isTomorrow, isAfter, startOfDay, addDays, isSameDay, format } from "date-fns";

export default function Home() {
  const { currentContext } = useGlobalContext();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
    // If we're updating the currently selected task, update that state too
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
    }
    await supabase.from("tasks").update({ status: newStatus }).eq("id", id);
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
    await supabase.from("tasks").update(updates).eq("id", id);
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

  // Tasks mapped for the rail (top level only or all? Let's use topLevelTasks for scheduling)
  const topLevelTasks = filteredTasks.filter(t => !t.parent_id);

  // Build tree only for today tasks
  const todayTaskTree = buildTaskTree(filteredTasks).filter(t => 
    t.scheduled_date && isToday(new Date(t.scheduled_date))
  );

  // Generate 7 days for the weekly rail
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  const getTaskCountForDate = (date: Date) => {
    return topLevelTasks.filter(t => t.scheduled_date && isSameDay(new Date(t.scheduled_date), date)).length;
  };

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

      {/* WEEKLY RAIL SECTION */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2">Weekly Rail</h2>
        <div className="grid grid-cols-7 gap-2 md:gap-4">
          {weekDays.map((date, i) => {
            const isTodayDate = i === 0;
            const taskCount = getTaskCountForDate(date);
            return (
              <div 
                key={date.toISOString()} 
                className={`flex flex-col items-center justify-between p-3 rounded-lg border transition-colors ${
                  isTodayDate ? "bg-white/10 border-white/20" : "bg-card border-border"
                }`}
              >
                <span className={`text-[10px] uppercase tracking-widest font-semibold ${isTodayDate ? "text-white" : "text-muted-foreground"}`}>
                  {isTodayDate ? "Today" : format(date, "EEE")}
                </span>
                <span className={`text-xs mt-1 ${isTodayDate ? "text-white/80" : "text-muted-foreground/50"}`}>
                  {format(date, "d")}
                </span>
                
                {/* Density Indicator */}
                <div className="mt-4 flex flex-col gap-1 w-full items-center h-12 justify-end">
                  {taskCount > 0 ? (
                    Array.from({ length: Math.min(taskCount, 5) }).map((_, idx) => (
                      <div key={idx} className={`w-full h-1.5 rounded-full ${isTodayDate ? "bg-white" : "bg-primary/50"}`} />
                    ))
                  ) : (
                    <div className="w-full h-1.5 rounded-full bg-border/30" />
                  )}
                  {taskCount > 5 && <span className="text-[9px] text-muted-foreground mt-1">+{taskCount - 5}</span>}
                </div>
              </div>
            );
          })}
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
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onToggleStatus={handleToggleStatus} 
                  onSelect={setSelectedTask} 
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Slide-over panel */}
      <TaskDetailsPanel 
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdateTask}
      />
    </div>
  );
}
