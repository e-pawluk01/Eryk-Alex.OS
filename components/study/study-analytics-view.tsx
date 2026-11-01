"use client";

import React, { useCallback, useEffect, useState } from "react";
import { endOfMonth, format, isSameDay } from "date-fns";
import { Loader2 } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { MetricSection } from "@/components/metric-section";
import { ChartFrame } from "@/components/charts/chart-frame";
import { ColumnChart } from "@/components/charts/column-chart";
import { comparisonWindow } from "@/lib/analytics-data";
import { fetchMonthStudySessions, fetchStudySessions, studiedHours } from "@/lib/study-analytics";
import { StudySession, STUDY_CHANGED_EVENT, formatDuration, studiedSeconds } from "@/lib/study-sessions";
import { StudyModule } from "@/lib/types";
import { StudyData } from "./use-study";

const OTHER_COLOR = "#555553";

/** Study analytics, opened from the Study side tab. */
export function StudyAnalyticsView({ study }: { study: StudyData }) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [prevHours, setPrevHours] = useState(0);
  const { person } = study;

  const load = useCallback(async () => {
    if (!person) return;
    setLoading(true);
    const span = comparisonWindow(new Date());
    const [month, prev] = await Promise.all([
      fetchMonthStudySessions(person, new Date()),
      fetchStudySessions(person, span.start, span.end),
    ]);
    setSessions(month);
    setPrevHours(studiedHours(prev));
    setLoading(false);
  }, [person]);

  useEffect(() => {
    load();
    window.addEventListener(STUDY_CHANGED_EVENT, load);
    return () => window.removeEventListener(STUDY_CHANGED_EVENT, load);
  }, [load]);

  const now = new Date();
  const span = comparisonWindow(now);
  const lastMonth = format(span.cutoff, "MMM");

  // --- Time ----------------------------------------------------------------
  const totalHours = studiedHours(sessions);
  const hoursPerWeek = totalHours / (now.getDate() / 7);
  const prevPerWeek = prevHours / (span.cutoff.getDate() / 7);
  const avgSession = sessions.length ? (totalHours * 3600) / sessions.length : 0;
  const dailyAvg = (totalHours * 3600) / now.getDate();
  const today = sessions.filter((s) => isSameDay(new Date(s.started_at), now)).reduce((acc, s) => acc + studiedSeconds(s), 0);

  // Last month's same days only when there was studying then to compare with.
  const vsLastMonth = (hours: number) => (prevHours > 0 ? `${lastMonth} same days · ${hours.toFixed(1)}h` : undefined);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500 relative">
      <div className="flex items-center justify-between border-b border-border pb-4 gap-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          {format(now, "MMMM")} Live
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />}
        </h2>
      </div>

      <div className="flex flex-col">
        {/* TIME — how much studying, and how it's spread */}
        <MetricSection
          title="Time"
          loading={loading}
          chart={<StudyHoursByWeekChart sessions={sessions} modules={study.modules} month={now} />}
        >
          <MetricCard title="Total Hours" value={totalHours.toFixed(1)} suffix="h" sub={vsLastMonth(prevHours)} />
          <MetricCard title="Hours / Week" value={hoursPerWeek.toFixed(1)} suffix="h" sub={vsLastMonth(prevPerWeek)} />
          <MetricCard title="Sessions" value={sessions.length}
            sub={sessions.length ? `avg ${formatDuration(avgSession)} each` : undefined} />
          <MetricCard title="Daily Average" compact value={formatDuration(dailyAvg)} sub={`today ${formatDuration(today)}`} />
        </MetricSection>
      </div>
    </div>
  );
}

// TIME — hours per week of the month, split by module (sessions with no module are "Other").
function StudyHoursByWeekChart({ sessions, modules, month }: { sessions: StudySession[]; modules: StudyModule[]; month: Date }) {
  const lastDay = endOfMonth(month).getDate();
  const today = new Date().getDate();
  const weeks = [1, 8, 15, 22, 29]
    .filter((start) => start <= Math.min(today, lastDay))
    .map((start) => ({ start, end: Math.min(start + 6, lastDay) }));
  const groups = [
    ...modules.map((m) => ({ id: m.id as string | null, name: m.name, color: m.color })),
    { id: null, name: "Other", color: OTHER_COLOR },
  ];

  const hoursIn = (id: string | null, w: { start: number; end: number }) =>
    sessions
      .filter((s) => {
        const d = new Date(s.started_at).getDate();
        // A session whose module was deleted counts as Other.
        const moduleId = modules.some((m) => m.id === s.module_id) ? s.module_id : null;
        return moduleId === id && d >= w.start && d <= w.end;
      })
      .reduce((acc, s) => acc + studiedSeconds(s), 0) / 3600;

  const series = groups
    .map((g) => ({ name: g.name, color: g.color, values: weeks.map((w) => hoursIn(g.id, w)) }))
    .filter((s) => s.values.some((v) => v > 0));
  const mon = format(month, "MMM");

  return (
    <ChartFrame
      title="Hours per week, by module"
      legend={series.map((s) => ({ label: s.name, color: s.color }))}
      empty={sessions.length === 0 ? "No study logged this month." : undefined}
    >
      {(width) => (
        <ColumnChart
          width={width}
          stacked
          categories={weeks.map((w) => (w.start === w.end ? `${w.start} ${mon}` : `${w.start}–${w.end} ${mon}`))}
          series={series}
          axisFormat={(v) => `${v}h`}
          tip={(c, s) => {
            const weekTotal = series.reduce((acc, x) => acc + x.values[c], 0);
            return `${weeks[c].start}–${weeks[c].end} ${mon}\n${series[s].name}: ${series[s].values[c].toFixed(1)}h\nWeek total: ${weekTotal.toFixed(1)}h`;
          }}
        />
      )}
    </ChartFrame>
  );
}
