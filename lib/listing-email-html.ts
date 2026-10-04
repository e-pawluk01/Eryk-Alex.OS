import type { DueItem, Step } from "./listing-ladder";
import type { LabDecision } from "./lab-sheet";

// The daily listings email, in the approved design: Refreshes, then Quick
// decisions, then a footer. Email clients ignore most stylesheets, so every
// style is inline.

const C = { ground: "#0a0a0a", line: "#242423", fg: "#f2f2f0", muted: "#8d8d88", warn: "#f0b37e" };
const MONO = "Menlo,Consolas,monospace";
const GROUPS: { step: Step; title: string; what: string; color: string }[] = [
  { step: "stage1", title: "Stage 1", what: "Refresh: new photos, title, description", color: "#60a5fa" },
  { step: "stage2", title: "Stage 2", what: "Refresh + reprice", color: "#a78bfa" },
  { step: "stage3", title: "Stage 3", what: "Refresh + bigger reprice", color: "#f59e0b" },
  { step: "checkin", title: "Check-in", what: "Refresh again, floor price, leave it (Hold) or remove", color: "#f87171" },
  { step: "floor", title: "Floor", what: "Refresh, or remove / bundle", color: "#9ca3af" },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const pill = (label: string, value: string, dashed = false) =>
  `<span style="display:inline-block;margin:6px 6px 0 0;padding:3px 8px;border:1px ${dashed ? "dashed" : "solid"} ${C.line};border-radius:6px;font-size:12px;color:${C.muted}">${label}<b style="color:${C.fg};margin-left:5px;font-family:${MONO}">${value}</b></span>`;

function row(d: DueItem, n: number) {
  const days = d.item.daysListed !== null ? `${d.item.daysListed} days` : "";
  const pills = [
    ...(d.prices ? [pill("Had interest", `£${d.prices.interest}`), pill("No interest", `£${d.prices.none}`)] : []),
    // A floor item is already at its floor: nothing to suggest.
    ...(d.floor !== null && d.step !== "floor" ? [pill("Floor", `£${d.floor}`, true)] : []),
  ].join("");
  return `<tr><td style="padding:12px 14px;${n ? `border-top:1px solid ${C.line}` : ""}">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td style="font-family:${MONO};font-size:14px;font-weight:600;color:${C.fg}">${esc(d.item.sku)}</td>
      <td style="text-align:right;font-family:${MONO};font-size:12px;color:${C.muted}">${days}</td>
    </tr></table>${pills ? `<div>${pills}</div>` : ""}
  </td></tr>`;
}

function group(items: DueItem[], g: (typeof GROUPS)[number]) {
  const these = items.filter((d) => d.step === g.step);
  if (!these.length) return "";
  return `<div style="margin-top:14px">
    <div style="margin-bottom:8px;font-size:12px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:8px;background:${g.color};margin-right:8px"></span>
      <b style="font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:${C.fg}">${g.title}</b>
      <span style="color:${C.muted};margin-left:8px">${g.what}</span>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid ${C.line};border-radius:10px;border-collapse:separate">
      ${these.map(row).join("")}
    </table>
  </div>`;
}

function section(title: string, items: DueItem[], steps: Step[]) {
  if (!items.length) return "";
  return `<div style="margin-top:26px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-bottom:1px solid ${C.line}"><tr>
      <td style="padding-bottom:8px;font-size:15px;font-weight:600;color:${C.fg}">${title}</td>
      <td style="padding-bottom:8px;text-align:right;font-size:12px;color:${C.muted}">${items.length} item${items.length === 1 ? "" : "s"}</td>
    </tr></table>
    ${GROUPS.filter((g) => steps.includes(g.step)).map((g) => group(items, g)).join("")}
  </div>`;
}

// Lab designs whose three-week test has ended with no decision yet.
function labSection(lab: LabDecision[]) {
  if (!lab.length) return "";
  const day = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `<div style="margin-top:26px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-bottom:1px solid ${C.line}"><tr>
      <td style="padding-bottom:8px;font-size:15px;font-weight:600;color:${C.fg}">Lab: decision due</td>
      <td style="padding-bottom:8px;text-align:right;font-size:12px;color:${C.muted}">Scale, adjust or drop</td>
    </tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;border:1px solid ${C.line};border-radius:10px;border-collapse:separate">
      ${lab.map((d, n) => `<tr><td style="padding:12px 14px;${n ? `border-top:1px solid ${C.line}` : ""}">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="font-family:${MONO};font-size:14px;font-weight:600;color:${C.fg}">${esc(d.sku || d.name || "No SKU")}</td>
          <td style="text-align:right;font-family:${MONO};font-size:12px;color:${C.muted}">Test ended ${day(d.end)}</td>
        </tr></table></td></tr>`).join("")}
    </table>
  </div>`;
}

export function listingEmailHtml({ refreshes, checkins, waiting, pastLimit, timingsLine, dateLabel, lab = [] }: {
  refreshes: DueItem[]; checkins: DueItem[]; waiting: number; pastLimit: number; timingsLine: string; dateLabel: string; lab?: LabDecision[];
}) {
  const total = refreshes.length + checkins.length;
  // Only shown when something is wrong.
  const status = pastLimit > 0
    ? `<div style="margin-top:22px;font-size:13px;color:${C.warn}">${pastLimit} listing${pastLimit === 1 ? " is" : "s are"} past ${pastLimit === 1 ? "its" : "their"} safety limit: do ${pastLimit === 1 ? "it" : "these"} first.</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:${C.ground}">
<div style="max-width:600px;margin:0 auto;padding:28px 22px 32px;background:${C.ground};color:${C.fg};font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
    <td><div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted}">Listings</div>
      <div style="margin-top:6px;font-size:26px;font-weight:600;color:${C.fg}">${total || !lab.length ? `${total} to update` : `${lab.length} lab decision${lab.length === 1 ? "" : "s"}`}</div></td>
    <td style="text-align:right;vertical-align:bottom;font-family:${MONO};font-size:12px;color:${C.muted}">${esc(dateLabel)}</td>
  </tr></table>
  ${status}
  ${section("Refreshes", refreshes, ["stage1", "stage2", "stage3"])}
  ${section("Quick decisions", checkins, ["checkin", "floor"])}
  ${labSection(lab)}
  <div style="margin-top:26px;border-top:1px solid ${C.line};padding-top:14px;font-size:12.5px;color:${C.muted}">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td>More due, waiting</td>
      <td style="text-align:right;font-family:${MONO};font-weight:600;color:${C.fg}">${waiting}</td>
    </tr></table>
    <div style="margin-top:6px">${esc(timingsLine)}</div>
  </div>
</div></body></html>`;
}
