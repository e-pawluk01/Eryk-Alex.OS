"use client";

import { useCallback, useEffect, useState } from "react";
import { subMonths } from "date-fns";
import { getMonthlyAnalytics } from "@/lib/sheets";
import { WorkSession, SESSIONS_CHANGED_EVENT } from "@/lib/work-sessions";
import {
  fetchMonthSessions, fetchHoursBetween, fetchFirstSessionAt, comparisonWindow, fetchRecentMonths,
} from "@/lib/analytics-data";

// Everything the analytics page loads: this month live, the same stretch of
// last month for the arrows, recent closed months for the chart, and the
// previous two months' sales and removals for the Categories window.
export function useAnalyticsData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [prevSales, setPrevSales] = useState<any>(null);
  const [prevHours, setPrevHours] = useState<number>(0);
  const [firstSessionAt, setFirstSessionAt] = useState<string | null>(null);
  const [recentMonths, setRecentMonths] = useState<{ label: string; revenue: number; grossProfit: number }[]>([]);
  const [earlierSales, setEarlierSales] = useState<any[]>([]);
  const [earlierRemoved, setEarlierRemoved] = useState<any[]>([]);
  const [previousItems, setPreviousItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const span = comparisonWindow(now);
      const [sheetsResult, sessionsResult, prevSalesResult, prevHoursResult, firstSessionResult, recentResult, month1, month2] =
        await Promise.all([
          getMonthlyAnalytics(),
          fetchMonthSessions(now),
          getMonthlyAnalytics(span.cutoff.toISOString(), span.soldBy),
          fetchHoursBetween(span.start, span.end),
          fetchFirstSessionAt(),
          fetchRecentMonths(5),
          getMonthlyAnalytics(subMonths(now, 1).toISOString()),
          getMonthlyAnalytics(subMonths(now, 2).toISOString()),
        ]);

      if (sheetsResult.error) setError(sheetsResult.error);
      else setData(sheetsResult.data);

      setSessions(sessionsResult);
      setPrevSales(prevSalesResult.error ? null : prevSalesResult.data);
      setPrevHours(prevHoursResult);
      setFirstSessionAt(firstSessionResult);
      setRecentMonths(recentResult);
      // A month with no sheet tab (e.g. before the app existed) just adds nothing.
      setEarlierSales([month1, month2].flatMap((m) => (m.error ? [] : m.data?.salesTable ?? [])));
      setEarlierRemoved([month1, month2].flatMap((m) => (m.error ? [] : m.data?.removedItems ?? [])));
      setPreviousItems(month1.error ? [] : month1.data?.items ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Clocking out, editing or adding a session anywhere refreshes the hours.
  useEffect(() => {
    const refresh = () => { fetchMonthSessions(new Date()).then(setSessions); };
    window.addEventListener(SESSIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SESSIONS_CHANGED_EVENT, refresh);
  }, []);

  return { loading, error, data, sessions, prevSales, prevHours, firstSessionAt, recentMonths, earlierSales, earlierRemoved, previousItems };
}
