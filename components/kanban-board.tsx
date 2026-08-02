"use client";

import React, { useMemo } from "react";
import { Task } from "@/lib/types";
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent, 
  DragOverlay,
  DragStartEvent,
  useDroppable
} from "@dnd-kit/core";
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lightbulb, PenLine, Video, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

type ColumnType = "idea" | "scripting" | "filming" | "editing";

interface KanbanBoardProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

const COLUMNS: { id: ColumnType; label: string; icon: React.ReactNode }[] = [
  { id: "idea", label: "Ideas", icon: <Lightbulb className="w-4 h-4 text-white/40 group-hover:text-yellow-500 transition-colors" /> },
  { id: "scripting", label: "Scripting", icon: <PenLine className="w-4 h-4 text-white/40 group-hover:text-blue-500 transition-colors" /> },
  { id: "filming", label: "Filming", icon: <Video className="w-4 h-4 text-white/40 group-hover:text-red-500 transition-colors" /> },
  { id: "editing", label: "Editing", icon: <Scissors className="w-4 h-4 text-white/40 group-hover:text-purple-500 transition-colors" /> }
];

export function KanbanBoard({ tasks, onUpdateTask }: KanbanBoardProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [maxScroll, setMaxScroll] = React.useState(1); // Default > 0 so right gradient shows initially
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const updateScrollState = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setScrollLeft(scrollLeft);
      setMaxScroll(scrollWidth - clientWidth);
    }
  };

  React.useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const columns = useMemo(() => {
    const cols: Record<ColumnType, Task[]> = {
      idea: [],
      scripting: [],
      filming: [],
      editing: []
    };
    tasks.forEach(t => {
      // Safety check just in case, though they should all be CONTENT
      const col = (t.kanban_column as ColumnType) || "idea";
      if (cols[col]) cols[col].push(t);
    });
    return cols;
  }, [tasks]);

  const activeTask = useMemo(
    () => tasks.find(t => t.id === activeId),
    [activeId, tasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    
    // Check if we dropped on a column container directly
    if (COLUMNS.find(c => c.id === over.id)) {
      if (task && task.kanban_column !== over.id) {
        onUpdateTask(taskId, { kanban_column: over.id as ColumnType });
      }
      return;
    }

    // Check if we dropped on an item within a column
    const overTask = tasks.find(t => t.id === over.id);
    if (task && overTask && task.kanban_column !== overTask.kanban_column) {
      onUpdateTask(taskId, { kanban_column: overTask.kanban_column as ColumnType });
    }
  };

  return (
    <div className="relative w-full h-[550px] overflow-hidden -mx-4 px-4 sm:mx-0 sm:px-0">
      {/* Scroll gradients - dynamic visibility */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-300",
        scrollLeft > 0 ? "opacity-100" : "opacity-0"
      )} />
      <div className={cn(
        "absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-300",
        scrollLeft < maxScroll - 1 ? "opacity-100" : "opacity-0"
      )} />

      <div 
        ref={scrollContainerRef}
        onScroll={updateScrollState}
        className="flex gap-6 overflow-x-auto h-full pb-4 px-4 sm:px-0 snap-x snap-mandatory hide-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {COLUMNS.map(col => (
            <KanbanColumn 
              key={col.id}
              column={col}
              tasks={columns[col.id]}
            />
          ))}

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function KanbanColumn({ column, tasks }: { column: typeof COLUMNS[0], tasks: Task[] }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div className="w-[320px] min-w-[320px] snap-start shrink-0 flex flex-col h-full group">
      <div className="pb-4 mb-4 flex items-center gap-3 relative">
        <div className="p-2 bg-transparent border border-white/5 rounded-lg">
          {column.icon}
        </div>
        <h3 className="font-medium text-xs uppercase tracking-[0.2em] text-white/50">{column.label}</h3>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground/30 bg-transparent px-2 py-0.5 rounded-full border border-white/5">
          {tasks.length}
        </span>
        <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div 
        ref={setNodeRef}
        className="flex-1 overflow-y-auto pb-8 flex flex-col gap-3 custom-scrollbar min-h-[150px]"
      >
        <SortableContext 
          items={tasks.map(t => t.id)} 
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/30 border-2 border-dashed border-white/5 rounded-lg py-8">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function SortableTask({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, isOverlay }: { task: Task, isOverlay?: boolean }) {
  return (
    <div className={cn(
      "bg-transparent border border-white/5 p-4 rounded-xl flex flex-col gap-2 hover:border-white/20 transition-all shadow-sm group relative hover:bg-white/[0.02]",
      isOverlay && "scale-105 shadow-2xl rotate-2 opacity-90 cursor-grabbing border-white/30 bg-[#0c0c0e]"
    )}>
      <h4 className="text-sm font-medium text-white/90 leading-tight break-words whitespace-normal">{task.title}</h4>
      {task.description && (
        <p className="text-[10px] font-semibold text-muted-foreground/40 line-clamp-2 mt-1">{task.description}</p>
      )}
    </div>
  );
}
