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
import { NewTopicDialog } from "@/components/new-topic-dialog";
import { TopicItem } from "@/components/topic-item";
import { HallOfFamePanel } from "@/components/hall-of-fame-panel";
import { CustomCheckbox } from "@/components/ui/custom-checkbox";
import { isToday, isTomorrow, isAfter, isBefore, startOfDay, addDays, isSameDay, format, subDays, parseISO, differenceInDays } from "date-fns";
import { Clock, Trophy, Pencil, X, Plus } from "lucide-react";
import { KanbanBoard } from "@/components/kanban-board";
import { VideoItem } from "@/components/video-item";
import { NewVideoDialog } from "@/components/new-video-dialog";
import { Video } from "@/lib/types";

export default function Home() {
  const { currentDomain, userEmail } = useGlobalContext();

  const handleAddVideo = (video: Video) => {
    setVideos(prev => [video, ...prev]);
  };

  const userContextName = (userEmail === "alexandra.ap.archive@gmail.com" ? "Alex" : "Eryk") as ContextType;
  const DOMAIN_MAP: Record<DomainType, ContextType[]> = useMemo(() => ({
    WORK: ["Eryk", "Alex"],
    STUDY: [userContextName as ContextType],
    CONTENT: [] 
  }), [userContextName]);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const [videoFilter, setVideoFilter] = useState<"All" | "Eryk" | "Alex">("All");
  const [contentTab, setContentTab] = useState<"videos" | "uploading">("videos");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [isHallOfFameOpen, setIsHallOfFameOpen] = useState(false);
  const goalsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollGoalsLeft, setCanScrollGoalsLeft] = useState(false);
  const [canScrollGoalsRight, setCanScrollGoalsRight] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalTitle, setEditingGoalTitle] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [goalsRes, tasksRes, eventsRes, topicsRes, videosRes] = await Promise.all([
          supabase.from("goals").select("*").order("year", { ascending: false }),
          supabase.from("tasks").select("*").order("created_at", { ascending: false }),
          supabase.from("events").select("*").order("event_date", { ascending: true }),
          supabase.from("study_topics").select("*").order("next_review_date", { ascending: true }),
          supabase.from("videos").select("*").order("created_at", { ascending: false }),
        ]);

        if (goalsRes.error) throw goalsRes.error;
        if (tasksRes.error) throw tasksRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (topicsRes.error) throw topicsRes.error;
        if (videosRes.error) throw videosRes.error;

        setGoals(goalsRes.data as Goal[]);
        setTasks(tasksRes.data as Task[]);
        setEvents(eventsRes.data as Event[]);
        setTopics(topicsRes.data as Topic[]);
        setVideos(videosRes.data as Video[]);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
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
        { event: '*', schema: 'public', table: 'goals' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setGoals(prev => prev.some(g => g.id === payload.new.id) ? prev : [payload.new as Goal, ...prev].sort((a, b) => b.year - a.year));
          } else if (payload.eventType === 'UPDATE') {
            setGoals(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...(payload.new as Partial<Goal>) } : g));
          } else if (payload.eventType === 'DELETE') {
            setGoals(prev => prev.filter(g => g.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_topics' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTopics(prev => prev.some(t => t.id === payload.new.id) ? prev : [...prev, payload.new as Topic].sort((a, b) => parseISO(a.next_review_date).getTime() - parseISO(b.next_review_date).getTime()));
          } else if (payload.eventType === 'UPDATE') {
            setTopics(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...(payload.new as Partial<Topic>) } : t));
          } else if (payload.eventType === 'DELETE') {
            setTopics(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'videos' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setVideos(prev => prev.some(v => v.id === payload.new.id) ? prev : [payload.new as Video, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setVideos(prev => prev.map(v => v.id === payload.new.id ? { ...v, ...(payload.new as Partial<Video>) } : v));
          } else if (payload.eventType === 'DELETE') {
            setVideos(prev => prev.filter(v => v.id !== payload.old.id));
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
  }, []);

  const handleToggleStatus = async (id: string, newStatus: "todo" | "done") => {
    setTasks(prev => 
      prev.map(t => t.id === id ? { ...t, status: newStatus } : t)
    );
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

  const handleUpdateGoalTitle = async (id: string) => {
    if (!editingGoalTitle.trim()) {
      setEditingGoalId(null);
      return;
    }
    setGoals(prev => prev.map(g => g.id === id ? { ...g, title: editingGoalTitle } : g));
    await supabase.from("goals").update({ title: editingGoalTitle.trim() }).eq("id", id);
    setEditingGoalId(null);
  };

  const handleAddGoal = (newGoal: Goal) => {
    setGoals(prev => [newGoal, ...prev].sort((a, b) => b.year - a.year));
  };

  const filteredTopics = useMemo(() => {
    const valid = ["Eryk", "Alex"];
    return topics.filter(t => valid.includes(t.context));
  }, [topics]);

  const filteredVideos = useMemo(() => {
    let result = videos;
    if (videoFilter !== "All") {
      result = result.filter(v => v.context === videoFilter);
    } else {
      const valid = ["Eryk", "Alex"];
      result = result.filter(v => valid.includes(v.context));
    }
    return result;
  }, [videos, videoFilter]);

  const handleUpdateTopic = (id: string, updates: Partial<Topic>) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t).sort((a, b) => parseISO(a.next_review_date).getTime() - parseISO(b.next_review_date).getTime()));
  };

  const handleAddTopic = (newTopic: Topic) => {
    setTopics(prev => [...prev, newTopic].sort((a, b) => parseISO(a.next_review_date).getTime() - parseISO(b.next_review_date).getTime()));
  };

  const handleUpdateVideo = (id: string, updates: Partial<Video>) => {
    setVideos(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const handleDeleteVideo = (id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const handleGenerateShortsTasks = async (video: Video) => {
    const newTasks = [];
    
    // Check if main upload task already exists
    const mainTaskExists = tasks.some(t => t.domain === "CONTENT" && t.title === `Upload Video: ${video.title}`);
    if (!mainTaskExists) {
      newTasks.push({
        title: `Upload Video: ${video.title}`,
        context: video.context, 
        domain: "CONTENT" as DomainType,
        status: "todo" as const,
        scheduled_date: video.scheduled_date || format(new Date(), "yyyy-MM-dd"),
      });
    }

    if (video.shorts_target && video.shorts_target > 0) {
      const alreadyGenerated = tasks.some(t => t.domain === "CONTENT" && t.title.includes(`for ${video.title}`));
      if (!alreadyGenerated) {
        const existingUploadTasks = tasks.filter(t => t.domain === "CONTENT" && t.context === video.context && t.title.toLowerCase().includes("upload"));
        const takenDates = new Set(existingUploadTasks.map(t => t.scheduled_date));
        
        let currentDate = addDays(parseISO(video.scheduled_date || format(new Date(), "yyyy-MM-dd")), 1);
        
        for (let i = 0; i < video.shorts_target; i++) {
          let dateString = format(currentDate, "yyyy-MM-dd");
          while (takenDates.has(dateString)) {
            currentDate = addDays(currentDate, 1);
            dateString = format(currentDate, "yyyy-MM-dd");
          }
          
          takenDates.add(dateString);
          
          newTasks.push({
            title: `Upload Short ${i + 1} for ${video.title}`,
            context: video.context, 
            domain: "CONTENT" as DomainType,
            status: "todo" as const,
            scheduled_date: dateString,
          });
          
          currentDate = addDays(currentDate, 1);
        }
      }
    }

    if (newTasks.length === 0) return;

    try {
      const { data, error } = await supabase.from("tasks").insert(newTasks).select();
      if (error) throw error;
      if (data) {
        setTasks(prev => [...data, ...prev]);
      }
    } catch (error) {
      console.error("Failed to generate shorts tasks:", error);
    }
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
    return tasks.filter(t => (currentDomain === "CONTENT" || valid.includes(t.context)) && (t.domain || "WORK") === currentDomain);
  }, [tasks, currentDomain]);

  const filteredEvents = useMemo(() => {
    const valid = DOMAIN_MAP[currentDomain];
    return events.filter(e => valid.includes(e.context) && (e.domain || "WORK") === currentDomain);
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
              <div key={goal.id} className="w-[280px] snap-start shrink-0 bg-card border border-border p-4 rounded-lg flex flex-col gap-3 justify-between group hover:border-primary/20 transition-colors relative">
                
                {editingGoalId !== goal.id && (
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingGoalTitle(goal.title);
                      setEditingGoalId(goal.id);
                    }}
                    className="absolute top-3 right-3 p-1.5 bg-background/80 hover:bg-white/10 rounded-md text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-20 backdrop-blur-sm"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}

                <div className="flex gap-3">
                  <div className="pt-0.5 shrink-0">
                    <CustomCheckbox 
                      checked={goal.status === "completed"} 
                      onChange={(checked) => handleToggleGoalStatus(goal.id, checked ? "completed" : "active")} 
                    />
                  </div>
                  <div className="relative flex-1 overflow-hidden">
                    <h3 className="font-medium text-foreground pr-8 whitespace-nowrap overflow-x-auto hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {goal.title}
                    </h3>
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card to-transparent pointer-events-none" />
                  </div>
                </div>
                <div className="flex justify-between items-center ml-8 shrink-0">
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
        
        {currentDomain === "CONTENT" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            
            {/* LEFT COLUMN: Content Tasks */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                  Content Tasks
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                {selectedDayTasks.length === 0 ? (
                  <p className="text-xs text-white/30 italic mt-2">No content tasks for this date.</p>
                ) : (
                  selectedDayTasks.map(task => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onToggleStatus={(id, status) => handleToggleStatus(id, status)}
                      onSelect={setSelectedTask}
                    />
                  ))
                )}
                <NewTaskDialog 
                  onTaskAdded={handleAddTask} 
                  domain={currentDomain}
                  contextName={userContextName}
                  selectedDateString={format(selectedDate, "yyyy-MM-dd")}
                />
              </div>
            </div>

            {/* RIGHT COLUMN: All Videos */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Videos</h2>
                
                <div className="flex items-center gap-1.5 opacity-30 hover:opacity-100 transition-opacity duration-300">
                  <button
                    onClick={() => setVideoFilter(videoFilter === "Eryk" ? "All" : "Eryk")}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full backdrop-blur-md transition-all duration-300",
                      videoFilter === "Eryk"
                        ? "bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.2)] border border-white/30"
                        : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    Eryk
                  </button>
                  <button
                    onClick={() => setVideoFilter(videoFilter === "Alex" ? "All" : "Alex")}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full backdrop-blur-md transition-all duration-300",
                      videoFilter === "Alex"
                        ? "bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.2)] border border-white/30"
                        : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    Alex
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {filteredVideos.map(video => (
                  <VideoItem 
                    key={video.id} 
                    video={video} 
                    onUpdate={handleUpdateVideo}
                    onDelete={handleDeleteVideo}
                    onGenerateTasks={handleGenerateShortsTasks}
                  />
                ))}
                <NewVideoDialog onVideoAdded={handleAddVideo} contextName={userContextName} />
              </div>
            </div>

          </div>
        ) : currentDomain === "WORK" || currentDomain === "STUDY" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {currentDomain === "WORK" ? (
              DOMAIN_MAP[currentDomain].map(contextName => {
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
                        domain={currentDomain}
                      />
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
                      <TopicItem key={topic.id} topic={topic} onUpdate={handleUpdateTopic} />
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
                          <TopicItem key={topic.id} topic={topic} onUpdate={handleUpdateTopic} />
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

      {editingGoalId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => { setEditingGoalId(null); setEditingGoalTitle(""); }} 
          />
          
          <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-2xl w-[90%] max-w-lg overflow-visible shadow-2xl shadow-black/50 animate-in fade-in zoom-in-[0.98] duration-300 slide-in-from-bottom-4">
            
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Edit Goal</span>
              <button 
                type="button"
                onClick={() => { setEditingGoalId(null); setEditingGoalTitle(""); }} 
                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateGoalTitle(editingGoalId);
              }} 
              className="px-6 pb-6 flex flex-col gap-6"
            >
              <textarea 
                placeholder="Goal title..."
                value={editingGoalTitle}
                onChange={(e) => setEditingGoalTitle(e.target.value)}
                autoFocus
                rows={4}
                className="w-full bg-transparent text-lg font-medium tracking-wide outline-none text-white placeholder:text-white/20 resize-none hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              />

              <button 
                type="submit"
                disabled={!editingGoalTitle.trim()}
                className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
