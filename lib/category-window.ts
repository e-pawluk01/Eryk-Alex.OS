import { rankCategoriesFairly, Ranking, RankingInput } from "./category-ranking";
import { EXIT_DATES_FROM } from "./stock-health";

// Which stretch of time Categories looks at (the advisor's rule): the
// shortest of the last 30, 60 or 90 days that holds enough stock to judge
// every category, i.e. items stocked >= k x number of categories. A window
// only counts once exit dates cover it; until one does, it's this month and
// the two before, as whole tabs.

export interface WindowInput {
  sales: (RankingInput["sales"][number] & { soldOn?: string | null })[];
  stock: RankingInput["stock"];
  removed: (RankingInput["removed"][number] & { exitOn?: string | null })[];
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function categoryWindow(input: WindowInput, today = new Date()): { ranking: Ranking; label: string } {
  for (const days of [30, 60, 90]) {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const from = dayKey(start), to = dayKey(today);
    if (from < EXIT_DATES_FROM) continue;
    const inside = (key?: string | null) => !!key && key >= from && key <= to;
    const ranking = rankCategoriesFairly({
      sales: input.sales.filter((s) => inside(s.soldOn)),
      stock: input.stock,
      removed: input.removed.filter((r) => inside(r.exitOn)),
    });
    const cats = ranking.categories.filter((c) => c.name !== "Other");
    const stocked = cats.reduce((a, c) => a + c.stocked, 0);
    if (cats.length && stocked >= ranking.business.trustK * cats.length) return { ranking, label: `Last ${days} days` };
  }
  return { ranking: rankCategoriesFairly(input), label: "Last 3 months" };
}
