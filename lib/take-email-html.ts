import type { Facts } from "./take-facts";
import type { Written } from "./take-writer";

// Claude's monthly take as an email, in the monthly PDF's look (approved
// mock-up, Oct 2026). Figures, cards, follow-ups and data notes come straight
// from the facts; only the sentences come from the model. Email clients
// ignore most stylesheets, so every style is inline.

const C = { ink: "#111111", muted: "#666666", faint: "#999999", rule: "#cfc9bd", soft: "#e7e3da", card: "#f7f5f1", head: "#f1efe9", label: "#35564f", up: "#2f6b3a", down: "#9a3b2e", desk: "#ecebe7" };
const FONT = "Helvetica,'Helvetica Neue',Arial,sans-serif";
const VERDICT = { baseline: "A baseline month.", normal: "A normal month.", good: "A good month.", weak: "A weak month." };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const gbp = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const badge = (text: string, color = C.muted, border = C.rule) =>
  `<span style="display:inline-block;font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:${color};border:1px solid ${border};border-radius:6px;padding:0 5px;margin-left:4px">${esc(text)}</span>`;

function section(label: string, caption: string, body: string) {
  return `<div style="margin-bottom:18px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-bottom:1px solid ${C.soft};margin-bottom:9px"><tr>
      <td style="padding-bottom:5px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;color:${C.label}">${label}</td>
      <td style="padding-bottom:5px;text-align:right;font-size:10px;color:${C.faint}">${caption}</td>
    </tr></table>${body}</div>`;
}

const p = (text: string, quiet = false) => `<p style="margin:0;font-size:13.5px;line-height:1.5;color:${quiet ? C.muted : C.ink}">${text}</p>`;
const list = (items: string[], quiet = false) =>
  `<table cellpadding="0" cellspacing="0" role="presentation" width="100%">${items.map((i) => `<tr><td style="padding:3px 0;font-size:13.5px;line-height:1.5;color:${quiet ? C.muted : C.ink}">${i}</td></tr>`).join("")}</table>`;

function table(head: string[], rows: string[][]) {
  const cell = (v: string, i: number, th = false) =>
    `<${th ? "th" : "td"} style="border:1px solid ${C.soft};padding:5px 8px;font-size:${th ? "9.5px" : "12.5px"};${th ? `background:${C.head};text-transform:uppercase;letter-spacing:.7px;font-weight:700;` : ""}text-align:${i ? "right" : "left"}">${v}</${th ? "th" : "td"}>`;
  return `<table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="border-collapse:collapse">
    <tr>${head.map((h, i) => cell(h, i, true)).join("")}</tr>
    ${rows.map((r) => `<tr>${r.map((v, i) => cell(v, i)).join("")}</tr>`).join("")}
  </table>`;
}

function card(label: string, value: string, sub: string) {
  return `<td width="33%" style="padding:0 5px;vertical-align:top">
    <div style="background:${C.card};border:1px solid ${C.soft};border-radius:4px;padding:10px 11px">
      <div style="font-size:9.5px;color:${C.muted};text-transform:uppercase;letter-spacing:1px">${label}</div>
      <div style="font-size:19px;font-weight:700;margin-top:4px">${value}</div>
      <div style="font-size:9.5px;color:${C.faint};text-transform:uppercase;letter-spacing:.8px;margin-top:3px">${sub}</div>
    </div></td>`;
}

function vs(now: number, before: number | undefined, money: boolean) {
  if (before === undefined) return "First month";
  const show = money ? gbp(before) : String(before);
  if (now === before) return `Same as last month`;
  const arrow = now > before ? `<span style="color:${C.up}">▲</span>` : `<span style="color:${C.down}">▼</span>`;
  return `${arrow} from ${show}`;
}

export function takeEmailHtml(f: Facts, w: Written | null) {
  const last = f.cards.last;
  const cards = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 -5px 22px"><tr>
    ${card("Items sold", String(f.cards.itemsSold), vs(f.cards.itemsSold, last?.itemsSold, false))}
    ${card("Average sale", gbp(f.cards.averageSale), vs(f.cards.averageSale, last?.averageSale, true))}
    ${card("Gross profit", gbp(f.cards.grossProfit), vs(f.cards.grossProfit, last?.grossProfit, true))}
  </tr></table>`;

  const body: string[] = [];
  if (w) {
    body.push(section("What changed", "Needs two months in a row",
      w.changed.length ? list(w.changed.map((c) => `${esc(c)} ${badge("Confirmed")}`)) : p("Nothing confirmed yet.", true)));

    if (w.changed.length) {
      const rp = f.revenueParts;
      const row = (name: string, [a, b]: [number | null, number], money: boolean) =>
        [name, a === null ? "–" : money ? gbp(a) : String(a), money ? gbp(b) : String(b)];
      body.push(section("Why", "From the data",
        table(["Revenue", "Last month", "This month"], [row("Items sold", rp.itemsSold, false), row("Average sale", rp.averageSale, true), row("Revenue", rp.revenue, true)])
        + (w.why ? `<div style="margin-top:7px">${p(esc(w.why), true)}</div>` : "")));
    }

    if (w.actions.length) {
      body.push(section("What to do", `Up to 3, ranked`, w.actions.map((a, i) => `
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="${i ? `border-top:1px solid ${C.soft};` : ""}"><tr>
          <td width="22" style="padding:9px 0;vertical-align:top;font-weight:700;color:${C.label};font-size:13.5px">${i + 1}</td>
          <td style="padding:9px 0">
            <div style="font-weight:700;font-size:13.5px;line-height:1.45">${esc(a.do)}</div>
            <div style="font-size:12.5px;color:${C.muted};margin-top:2px">Because <span style="color:${C.ink}">${esc(a.because)}</span></div>
            <div style="font-size:12.5px;color:${C.muted};margin-top:2px">Check <span style="color:${C.ink}">${esc(a.check)}</span></div>
          </td></tr></table>`).join("")));
    }

    if (w.watch.length) body.push(section("What to watch", "Not for action yet", list(w.watch.map(esc))));
  } else {
    body.push(section("Written analysis", "", p("Left out this month: it used figures that didn't match the data twice, so it wasn't sent. The figures above are correct.", true)));
  }

  const RESULT = { moved: badge("Moved", C.up, "#b9d3bd"), "no change": badge("No change"), "wrong way": badge("Wrong way", C.down, "#e2c2bc"), unknown: badge("No figure") };
  body.push(section("Last month's actions", "", f.followUps.length
    ? list(f.followUps.map((u) => `${esc(u.do)}: ${u.before ?? "–"} → ${u.now ?? "–"}. ${RESULT[u.result]}`))
    : p(f.firstTake ? "First take, so none to follow up." : "No actions last month.", true)));

  const notes: string[] = [];
  if (f.bought.length > 1 || (f.bought.length === 1 && f.bought[0].from !== "Not filled in")) {
    notes.push(table(["Stock bought", "Items", "Spend"], f.bought.map((b) => [esc(b.from), String(b.items), gbp(b.spend)])));
  } else if (f.bought.length) {
    notes.push(p(`Stock bought: ${f.bought[0].items} items for ${gbp(f.bought[0].spend)}.`, true));
  }
  if (f.platforms.length) notes.push(table(["Platform", "Sales", "Profit"], f.platforms.map((x) => [esc(x.name), String(x.sales), gbp(x.profit)])));
  const extra = [...f.dataNotes];
  if (f.hoursByTask.length) extra.unshift(`Hours by task: ${f.hoursByTask.map((t) => `${esc(t.task.toLowerCase())} ${t.hours}h`).join(", ")}.`);
  if (extra.length) notes.push(list(extra, true));
  body.push(section("Data notes", "", notes.join(`<div style="height:8px"></div>`)));

  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px 12px;background:${C.desk}">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${C.soft};padding:32px 30px 24px;font-family:${FONT};color:${C.ink}">
  <div style="border-bottom:1px solid ${C.rule};padding-bottom:10px;margin-bottom:18px">
    <div style="font-size:24px;font-weight:700;margin-bottom:5px">Claude's Take</div>
    <div style="font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:2px">${esc(f.monthName)}</div>
  </div>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.45"><b>${VERDICT[f.verdict]}</b>${w?.reason ? ` ${esc(w.reason)}` : ""}</p>
  ${cards}
  ${body.join("")}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${C.soft};margin-top:8px"><tr>
    <td style="padding-top:8px;font-size:9.5px;color:${C.faint};text-transform:uppercase;letter-spacing:1.4px">Written by Claude from the report's figures</td>
    <td style="padding-top:8px;text-align:right;font-size:9.5px;color:${C.faint};text-transform:uppercase;letter-spacing:1.4px">${w ? "Every number checked" : "Figures only"}</td>
  </tr></table>
</div></body></html>`;
}
