"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Goal, Task, Event, ContextType } from "@/lib/types";
import { useGlobalContext, DomainType } from "@/components/global-context";
import { cn } from "@/lib/utils";
import { ContextTag } from "@/components/ui/context-tag";
import { TaskItem } from "@/components/task-item";
import { TaskDetailsPanel } from "@/components/task-details-panel";
import { EventDetailsPanel } from "@/components/event-details-panel";
import { CalendarPanel } from "@/components/calendar-panel";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { NewGoalDialog } from "@/components/new-goal-dialog";
import { HallOfFamePanel } from "@/components/hall-of-fame-panel";
import { CustomCheckbox } from "@/components/ui/custom-checkbox";
import { isToday, isTomorrow, isAfter, isBefore, startOfDay, addDays, isSameDay, format, subDays, parseISO } from "date-fns";
import { Clock, Trophy } from "lucide-react";

export default function Home() {
  const { currentDomain, userEmail } = useGlobalContext();

  const userContextName = userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk";

  const DOMAIN_MAP: Record<DomainType, ContextType[]> = useMemo(() => ({
    WORK: ["Eryk", "Alex"],
    STUDY: [userContextName as ContextType],
    CONTENT: [] 
  }), [userContextName]);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [isHallOfFameOpen, setIsHallOfFameOpen] = useState(false);

  const goalsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollGoalsLeft, setCanScrollGoalsLeft] = useState(false);
  const [canScrollGoalsRight, setCanScrollGoalsRight] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [goalsRes, tasksRes, eventsRes] = await Promise.all([
          supabase.from("goals").select("*").order("year", { ascending: false }),
          supabase.from("tasks").select("*").order("created_at", { ascending: false }),
          supabase.from("events").select("*").order("event_date", { ascending: true })
        ]);

        if (goalsRes.error) throw goalsRes.error;
        if (tasksRes.error) throw tasksRes.error;
        if (eventsRes.error) throw eventsRes.error;

        setGoals(goalsRes.data as Goal[]);
        setTasks(tasksRes.data as Task[]);
        setEvents(eventsRes.data as Event[]);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
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

  const handleDeleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTask?.id === id) {
      setSelectedTask(null);
    }
    await supabase.from("tasks").delete().eq("id", id);
  };

  const handleAddTask = (newTask: Task) => {
    setTasks(prev => [newTask, ...prev]);
  };

  const handleAddEvent = (newEvent: Event) => {
    setEvents(prev => [...prev, newEvent].sort((a, b) => parseISO(a.event_date).getTime() - parseISO(b.event_date).getTime()));
  };

  const handleToggleGoalStatus = async (id: string, newStatus: "active" | "completed") => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, status: newStatus } : g));
    await supabase.from("goals").update({ status: newStatus }).eq("id", id);
  };

  const handleAddGoal = (newGoal: Goal) => {
    setGoals(prev => [newGoal, ...prev].sort((a, b) => b.year - a.year));
  };

  const handleUpdateEvent = async (id: string, updates: Partial<Event>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (selectedEvent?.id === id) {
      setSelectedEvent(prev => prev ? { ...prev, ...updates } : null);
    }
    await supabase.from("events").update(updates).eq("id", id);
  };

  const handleDeleteEvent = async (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    await supabase.from("events").delete().eq("id", id);
  };

  const filteredGoals = useMemo(() => {
    // If a goal was created previously under 'Reselling' or 'Drink idea', treat it as 'WORK'
    return goals.filter(g => 
      g.context === currentDomain || 
      (currentDomain === "WORK" && ["Reselling", "Drink idea"].includes(g.context)) ||
      (currentDomain === "STUDY" && ["Eryk", "Alex"].includes(g.context))
    );
  }, [goals, currentDomain]);

  const filteredTasks = useMemo(() => {
    const valid = DOMAIN_MAP[currentDomain];
    return tasks.filter(t => valid.includes(t.context));
  }, [tasks, currentDomain]);

  const filteredEvents = useMemo(() => {
    const valid = DOMAIN_MAP[currentDomain];
    return events.filter(e => valid.includes(e.context));
  }, [events, currentDomain]);

  const upcomingEvents = useMemo(() => {
    return filteredEvents
      .filter(e => {
        const date = parseISO(e.event_date);
        return isAfter(date, subDays(new Date(), 1)) && isBefore(date, addDays(new Date(), 8));
      }) // include today up to 7 days in the future
      .sort((a, b) => parseISO(a.event_date).getTime() - parseISO(b.event_date).getTime())
      .slice(0, 3); // next 3 upcoming within a week
  }, [filteredEvents]);

  const checkGoalsScroll = () => {
    if (goalsScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = goalsScrollRef.current;
      setCanScrollGoalsLeft(scrollLeft > 0);
      setCanScrollGoalsRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkGoalsScroll();
    window.addEventListener('resize', checkGoalsScroll);
    return () => window.removeEventListener('resize', checkGoalsScroll);
  }, [filteredGoals]);

  // Tasks mapped for the rail
  const topLevelTasks = filteredTasks.filter(t => !t.parent_id);

  // Filter tasks for the selected date
  const selectedDayTasks = filteredTasks.filter(t => 
    t.scheduled_date && isSameDay(new Date(t.scheduled_date), selectedDate)
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
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Goals</h2>
          <button 
            onClick={() => setIsHallOfFameOpen(true)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-yellow-500/70 hover:text-yellow-500 transition-colors bg-yellow-500/10 px-2 py-1 rounded"
          >
            <Trophy className="w-3 h-3" />
            Hall of Goals
          </button>
        </div>
        
        <div className="relative w-full">
          {/* Fade indicators */}
          <div className={cn(
            "absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-300",
            canScrollGoalsLeft ? "opacity-100" : "opacity-0"
          )} />
          <div className={cn(
            "absolute right-0 top-0 bottom-4 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-300",
            canScrollGoalsRight ? "opacity-100" : "opacity-0"
          )} />
          
          <div 
            ref={goalsScrollRef}
            onScroll={checkGoalsScroll}
            className="flex gap-4 overflow-x-auto pb-4 px-2 snap-x snap-mandatory hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {filteredGoals.filter(g => g.status !== "completed").map(goal => (
              <div key={goal.id} className="min-w-[280px] snap-start shrink-0 bg-card border border-border p-4 rounded-lg flex flex-col gap-3 justify-between group hover:border-primary/20 transition-colors">
                <div className="flex gap-3">
                  <div className="pt-0.5">
                    <CustomCheckbox 
                      checked={goal.status === "completed"} 
                      onChange={(checked) => handleToggleGoalStatus(goal.id, checked ? "completed" : "active")} 
                    />
                  </div>
                  <h3 className="font-medium text-foreground">{goal.title}</h3>
                </div>
                <div className="flex justify-between items-center ml-8">
                  <span className="text-xs text-muted-foreground">{goal.year}</span>
                </div>
              </div>
            ))}
            <div className="snap-start shrink-0">
              <NewGoalDialog onGoalAdded={handleAddGoal} currentDomain={currentDomain} />
            </div>
          </div>
        </div>
      </section>

      {/* WEEK SECTION */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2">Week</h2>
        <div className="grid grid-cols-7 gap-2 md:gap-4">
          {weekDays.map((date, i) => {
            const isTodayDate = i === 0;
            const isSelected = isSameDay(date, selectedDate);
            const taskCount = getTaskCountForDate(date);
            return (
              <button 
                key={date.toISOString()} 
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                  isSelected 
                    ? "bg-white/10 border-white/20" 
                    : isTodayDate 
                      ? "bg-white/5 border-white/10"
                      : "bg-card border-border hover:bg-white/5"
                }`}
              >
                <span className={`text-[10px] uppercase tracking-widest font-semibold ${isSelected || isTodayDate ? "text-white" : "text-muted-foreground"}`}>
                  {isTodayDate ? "Today" : format(date, "EEE")}
                </span>
                <span className={`text-xs mt-1 ${isSelected || isTodayDate ? "text-white/80" : "text-muted-foreground/50"}`}>
                  {format(date, "d")}
                </span>
                
                {/* Text Indicator */}
                <div className="mt-3 flex flex-col gap-1 w-full items-center justify-end h-8">
                  {taskCount > 0 ? (
                    <span className={`text-[10px] font-medium ${isSelected ? "text-white" : "text-primary/70"}`}>{taskCount} task{taskCount > 1 ? 's' : ''}</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">-</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* UPCOMING EVENTS WIDGET */}
      {currentDomain === "WORK" && upcomingEvents.length > 0 && (
        <section className="flex flex-col gap-3 pb-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Upcoming Events</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {upcomingEvents.map(event => (
              <div 
                key={event.id} 
                onClick={() => setSelectedEvent(event)}
                className="flex flex-col gap-1 bg-card/50 border border-border rounded-lg px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold truncate">{event.title}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {isToday(parseISO(event.event_date)) ? "Today" : 
                   isTomorrow(parseISO(event.event_date)) ? "Tomorrow" : 
                   format(parseISO(event.event_date), "MMM d")} 
                  {event.event_time && ` • ${event.event_time.slice(0, 5)}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TODAY'S TASKS LIST SECTION */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {isSameDay(selectedDate, startOfDay(new Date())) ? "Today" : format(selectedDate, "MMM d, yyyy")}
          </h2>
        </div>
        
        {currentDomain === "WORK" || currentDomain === "STUDY" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {DOMAIN_MAP[currentDomain].map(contextName => {
              const contextTasks = selectedDayTasks.filter(t => t.context === contextName);
              
              return (
                <div key={contextName} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{contextName}</h3>
                    <div className="h-px bg-border flex-1" />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {contextTasks.map(task => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        onToggleStatus={handleToggleStatus} 
                        onSelect={() => setSelectedTask(task)}
                      />
                    ))}
                    <NewTaskDialog 
                      contextName={contextName} 
                      selectedDateString={format(selectedDate, "yyyy-MM-dd")} 
                      onTaskAdded={handleAddTask} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-card/20">
            <p className="text-muted-foreground uppercase tracking-widest text-xs">
              Custom layout for {currentDomain} domain coming in next phase.
            </p>
          </div>
        )}
      </section>

      {/* Slide-over panel */}
      <TaskDetailsPanel 
        task={selectedTask} 
        isOpen={!!selectedTask} 
        onClose={() => setSelectedTask(null)} 
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
      />

      <EventDetailsPanel 
        event={selectedEvent} 
        isOpen={!!selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />

      <CalendarPanel 
        tasks={tasks}
        events={events}
        currentDomain={currentDomain}
        userEmail={userEmail}
        onAddTask={handleAddTask}
        onAddEvent={handleAddEvent}
        onSelectTask={setSelectedTask}
        onSelectEvent={setSelectedEvent}
      />

      <HallOfFamePanel
        isOpen={isHallOfFameOpen}
        onClose={() => setIsHallOfFameOpen(false)}
        goals={filteredGoals}
        onToggleStatus={handleToggleGoalStatus}
      />
    </div>
  );
}
