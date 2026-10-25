"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Task, Event, Topic, ContextType } from "@/lib/types";
import { useGlobalContext, DomainType } from "@/components/global-context";
import { cn } from "@/lib/utils";
import { ContextTag } from "@/components/ui/context-tag";
import { TaskItem } from "@/components/task-item";
import { TaskDetailsPanel } from "@/components/task-details-panel";
import { EventDetailsPanel } from "@/components/event-details-panel";
import { CalendarPanel } from "@/components/calendar-panel";
import { AnalyticsView } from "@/components/analytics-view";
import { ActiveSessionWidget } from "@/components/active-session-widget";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { NewTopicDialog } from "@/components/new-topic-dialog";
import { TopicItem } from "@/components/topic-item";
import { WorkUpcoming } from "@/components/work-upcoming";
import { TaskKanban } from "@/components/task-kanban";
import { useStudy } from "@/components/study/use-study";
import { UpcomingStrip } from "@/components/study/upcoming-strip";
import { DeadlinesView } from "@/components/study/deadlines-view";
import { MaterialsView, WorkingThrough } from "@/components/study/materials-view";
import { StudyClock } from "@/components/study/study-clock";
import { useMusic } from "@/components/study/use-music";
import { MusicPlayer } from "@/components/study/music-player";
import { LectureReminder } from "@/components/study/lecture-reminder";
import { TagsProvider } from "@/components/tags/tags";
import { ModuleDot } from "@/components/study/bits";
import { rolloverTasks } from "@/lib/task-rollover";
import { startOfDay, addDays, isSameDay, format, parseISO, differenceInDays } from "date-fns";
import { Plus } from "lucide-react";

export default function Home() {
  const { currentDomain, userEmail } = useGlobalContext();

  const userContextName = (userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk") as ContextType;
  const DOMAIN_MAP: Record<DomainType, ContextType[]> = useMemo(() => ({
    WORK: ["Eryk", "Alex"],
    STUDY: [userContextName as ContextType],
  }), [userContextName]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const [showAnalytics, setShowAnalytics] = useState(false);
  // Which Study page is open from the side tabs (null = Study home).
  const [studyPage, setStudyPage] = useState<"deadlines" | "materials" | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  // Today in Work: both of you side by side, or your own Kanban board.
  const [todayView, setTodayView] = useState<"overview" | "kanban">("overview");
  useEffect(() => {
    try { if (localStorage.getItem("work-today-view") === "kanban") setTodayView("kanban"); } catch { /* optional */ }
  }, []);
  const pickTodayView = (v: "overview" | "kanban") => {
    setTodayView(v);
    try { localStorage.setItem("work-today-view", v); } catch { /* optional */ }
  };

  // Work is shared; Study belongs to whoever is logged in. Only that person's
  // Study rows are downloaded or kept from live updates.
  const me = userEmail ? userContextName : null;
  const isMine = (row: { domain?: string | null; context: string }) =>
    (row.domain || "WORK") === "WORK" || row.context === me;
  const study = useStudy(me);
  const music = useMusic(me);
  useEffect(() => {
    if (!me) return;
    const workOrMine = `domain.is.null,domain.eq.WORK,and(domain.eq.STUDY,context.eq.${me})`;
    async function fetchData() {
      try {
        // Tidy up past days first so the list loads already rolled over.
        await rolloverTasks(supabase).catch(err => console.error("Task rollover failed:", err));
        const [tasksRes, eventsRes, topicsRes] = await Promise.all([
          supabase.from("tasks").select("*").or(workOrMine).order("created_at", { ascending: false }),
          supabase.from("events").select("*").or(workOrMine).order("event_date", { ascending: true }),
          supabase.from("study_topics").select("*").eq("context", me).order("next_review_date", { ascending: true }),
        ]);

        if (tasksRes.error) throw tasksRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (topicsRes.error) throw topicsRes.error;

        setTasks(tasksRes.data as Task[]);
        setEvents(eventsRes.data as Event[]);
        setTopics(topicsRes.data as Topic[]);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [me]);

  // If the app is left open overnight, roll tasks over at midnight and move
  // the day view on to the new today.
  useEffect(() => {
    if (!me) return;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = startOfDay(addDays(now, 1));
      timer = setTimeout(async () => {
        try {
          await rolloverTasks(supabase);
          const { data, error } = await supabase.from("tasks").select("*")
            .or(`domain.is.null,domain.eq.WORK,and(domain.eq.STUDY,context.eq.${me})`)
            .order("created_at", { ascending: false });
          if (error) throw error;
          setTasks(data as Task[]);
        } catch (err) {
          console.error("Task rollover failed:", err);
        }
        const yesterday = startOfDay(now);
        setSelectedDate(prev => isSameDay(prev, yesterday) ? startOfDay(new Date()) : prev);
        scheduleMidnight();
      }, nextMidnight.getTime() - now.getTime() + 1000);
    };
    scheduleMidnight();
    return () => clearTimeout(timer);
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (!isMine(payload.new as Task)) return;
            setTasks(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new as Task, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...(payload.new as Partial<Task>) } : t));
            setSelectedTask(prev => prev?.id === payload.new.id ? { ...prev, ...(payload.new as Partial<Task>) } : prev);
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id));
            setSelectedTask(prev => prev?.id === payload.old.id ? null : prev);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (!isMine(payload.new as Event)) return;
            setEvents(prev => prev.some(e => e.id === payload.new.id) ? prev : [...prev, payload.new as Event].sort((a, b) => parseISO(a.event_date).getTime() - parseISO(b.event_date).getTime()));
          } else if (payload.eventType === 'UPDATE') {
            setEvents(prev => prev.map(e => e.id === payload.new.id ? { ...e, ...(payload.new as Partial<Event>) } : e));
            setSelectedEvent(prev => prev?.id === payload.new.id ? { ...prev, ...(payload.new as Partial<Event>) } : prev);
          } else if (payload.eventType === 'DELETE') {
            setEvents(prev => prev.filter(e => e.id !== payload.old.id));
            setSelectedEvent(prev => prev?.id === payload.old.id ? null : prev);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_topics' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if ((payload.new as Topic).context !== me) return;
            setTopics(prev => prev.some(t => t.id === payload.new.id) ? prev : [...prev, payload.new as Topic].sort((a, b) => parseISO(a.next_review_date).getTime() - parseISO(b.next_review_date).getTime()));
          } else if (payload.eventType === 'UPDATE') {
            setTopics(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...(payload.new as Partial<Topic>) } : t));
          } else if (payload.eventType === 'DELETE') {
            setTopics(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully connected to realtime channel');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Failed to subscribe to realtime channel:', status, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me]);

  // Ticking or unticking takes a task out of In progress. A ticked progress-bar
  // task shows a full bar; unticking one that was dragged to 100% empties it.
  const handleToggleStatus = async (id: string, newStatus: "todo" | "done") => {
    const task = tasks.find(t => t.id === id);
    const updates: Partial<Task> = { status: newStatus, in_progress: false };
    if (newStatus === "todo" && task?.track_progress && (task.progress ?? 0) >= 100) updates.progress = 0;
    setTasks(prev => 
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
    await supabase.from("tasks").update(updates).eq("id", id);
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

  const filteredTopics = useMemo(() => {
    const valid = ["Eryk", "Alex"];
    return topics.filter(t => valid.includes(t.context));
  }, [topics]);

  const handleUpdateTopic = (id: string, updates: Partial<Topic>) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t).sort((a, b) => parseISO(a.next_review_date).getTime() - parseISO(b.next_review_date).getTime()));
  };

  const handleDeleteTopic = (id: string) => {
    setTopics(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTopic = (newTopic: Topic) => {
    setTopics(prev => [...prev, newTopic].sort((a, b) => parseISO(a.next_review_date).getTime() - parseISO(b.next_review_date).getTime()));
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

  const filteredTasks = useMemo(() => {
    const valid = DOMAIN_MAP[currentDomain];
    return tasks.filter(t => valid.includes(t.context) && (t.domain || "WORK") === currentDomain);
  }, [tasks, currentDomain]);

  const filteredEvents = useMemo(() => {
    const valid = DOMAIN_MAP[currentDomain];
    return events.filter(e => valid.includes(e.context) && (e.domain || "WORK") === currentDomain);
  }, [events, currentDomain]);

  // Tasks mapped for the rail
  const topLevelTasks = filteredTasks.filter(t => !t.parent_id);

  // Filter tasks for the selected date
  // Pinned tasks first, otherwise in the usual order.
  const selectedDayTasks = filteredTasks
    .filter(t => t.scheduled_date && isSameDay(new Date(t.scheduled_date), selectedDate))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  // Filter topics for user
  const userTopics = useMemo(() => {
    return topics.filter(t => t.context === userContextName);
  }, [topics, userContextName]);

  const dueTopics = useMemo(() => {
    const today = startOfDay(new Date());
    return userTopics.filter(t => differenceInDays(startOfDay(new Date(t.next_review_date)), today) <= 0);
  }, [userTopics]);

  const upcomingTopics = useMemo(() => {
    const today = startOfDay(new Date());
    return userTopics.filter(t => differenceInDays(startOfDay(new Date(t.next_review_date)), today) > 0);
  }, [userTopics]);

  // Generate 7 days for the weekly rail
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  const getTaskCountForDate = (date: Date) => {
    return topLevelTasks.filter(t => t.status !== "done" && t.scheduled_date && isSameDay(new Date(t.scheduled_date), date)).length;
  };

  if (loading) {
    return <div className="animate-pulse flex flex-col gap-12 mt-8">
      <div className="h-32 bg-secondary rounded-lg"></div>
      <div className="h-64 bg-secondary rounded-lg"></div>
    </div>;
  }

  return (
    <TagsProvider me={me}>
    <div className="flex flex-col gap-12 mt-4 pb-20">
      {currentDomain === "WORK" && (
        <ActiveSessionWidget music={music} />
      )}
      <StudyClock study={study} music={music} visible={currentDomain === "STUDY"} />
      <MusicPlayer music={music} />
      <LectureReminder events={events} />
      {currentDomain === "WORK" && showAnalytics ? (
        <AnalyticsView />
      ) : currentDomain === "STUDY" && studyPage === "deadlines" ? (
        <DeadlinesView study={study} />
      ) : currentDomain === "STUDY" && studyPage === "materials" ? (
        <MaterialsView study={study} />
      ) : (
        <>
      {currentDomain === "STUDY" ? (
        <UpcomingStrip study={study} events={events} onSelectEvent={setSelectedEvent} />
      ) : (
        <WorkUpcoming tasks={tasks} events={filteredEvents} me={userContextName} onSelectTask={setSelectedTask} onSelectEvent={setSelectedEvent} />
      )}

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
                  {currentDomain === "STUDY" && (
                    <span className="flex gap-1 h-2">
                      {study.deadlines.filter(d => !d.done && isSameDay(parseISO(d.cutoff_on), date)).map(d => (
                        <ModuleDot key={d.id} module={study.modules.find(m => m.id === d.module_id)} />
                      ))}
                    </span>
                  )}
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

      {/* TODAY'S TASKS LIST SECTION */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {isSameDay(selectedDate, startOfDay(new Date())) ? "Today" : format(selectedDate, "MMM d, yyyy")}
          </h2>
          {currentDomain === "WORK" && (
            <div className="flex gap-1.5">
              {(["overview", "kanban"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => pickTodayView(v)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border transition-all",
                    todayView === v ? "bg-white/15 text-white border-white/30" : "bg-white/[0.03] text-white/40 border-white/10 hover:text-white"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

          {currentDomain === "WORK" && todayView === "kanban" ? (
            <TaskKanban
              tasks={selectedDayTasks.filter(t => !t.parent_id && (t.context === userContextName || t.is_joint))}
              onSelect={setSelectedTask}
              onUpdate={handleUpdateTask}
              onToggleStatus={handleToggleStatus}
            />
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {currentDomain === "WORK" ? (
              DOMAIN_MAP[currentDomain].map(contextName => {
                const contextTasks = selectedDayTasks.filter(t => t.context === contextName || (t.is_joint && ['Eryk', 'Alex'].includes(contextName)));
                
                return (
                  <div key={contextName} className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{contextName}</h3>
                      <div className="h-px bg-border flex-1" />
                      <NewTaskDialog 
                        contextName={contextName} 
                        selectedDateString={format(selectedDate, "yyyy-MM-dd")} 
                        onTaskAdded={handleAddTask} 
                        domain={currentDomain}
                        trigger={
                          <div title={`Add to ${contextName}`} className="w-8 h-8 rounded-full border border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 text-white/40 hover:text-white transition-all flex items-center justify-center shrink-0">
                            <Plus className="w-4 h-4" />
                          </div>
                        }
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {contextTasks.map(task => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          onToggleStatus={handleToggleStatus} 
                          onSelect={() => setSelectedTask(task)}
                          onUpdate={handleUpdateTask}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              // STUDY Layout
              <>
                {/* Column 1: Study Tasks */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Study Tasks</h3>
                    <div className="h-px bg-border flex-1" />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {selectedDayTasks.filter(t => t.context === userContextName).map(task => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        onToggleStatus={handleToggleStatus} 
                        onSelect={() => setSelectedTask(task)}
                        onUpdate={handleUpdateTask}
                      />
                    ))}
                    <NewTaskDialog 
                      contextName={userContextName as ContextType} 
                      selectedDateString={format(selectedDate, "yyyy-MM-dd")} 
                      onTaskAdded={handleAddTask} 
                      domain={currentDomain}
                    />
                  </div>
                </div>

                {/* Column 2: Revisions (Spaced Repetition) */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Revisions</h3>
                    <div className="h-px bg-border flex-1" />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {/* Due Today (Capped at 3) */}
                    {dueTopics.slice(0, 3).map(topic => (
                      <TopicItem key={topic.id} topic={topic} onUpdate={handleUpdateTopic} onDelete={handleDeleteTopic} />
                    ))}
                    
                    {dueTopics.length > 3 && (
                      <div className="text-center py-2 text-[10px] uppercase tracking-widest text-muted-foreground/50 border border-dashed border-border rounded-lg">
                        + {dueTopics.length - 3} more in queue
                      </div>
                    )}
                    
                    {dueTopics.length === 0 && upcomingTopics.length > 0 && (
                      <div className="text-center py-4 text-[10px] uppercase tracking-widest text-muted-foreground border border-dashed border-border rounded-lg">
                        No revisions due today
                      </div>
                    )}

                    {/* Upcoming Overview */}
                    {upcomingTopics.length > 0 && (
                      <div className="mt-4 flex flex-col gap-2 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2">Upcoming</span>
                        {upcomingTopics.slice(0, 5).map(topic => (
                          <TopicItem key={topic.id} topic={topic} onUpdate={handleUpdateTopic} onDelete={handleDeleteTopic} />
                        ))}
                      </div>
                    )}

                    <NewTopicDialog 
                      contextName={userContextName as ContextType}
                      onTopicAdded={handleAddTopic}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          )}
      </section>
      {currentDomain === "STUDY" && <WorkingThrough study={study} />}
      </>
      )}
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
        onAnalyticsToggle={() => setShowAnalytics(!showAnalytics)}
        showAnalytics={showAnalytics}
        studyPage={studyPage}
        onStudyPageToggle={page => setStudyPage(studyPage === page ? null : page)}
      />

    </div>
    </TagsProvider>
  );
}
