// Study playlist helpers.

/** The 11-character video id from any usual YouTube link, or null. */
export function parseVideoId(link: string): string | null {
  const s = link.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
    const id = (raw: string | null | undefined) => (raw && /^[\w-]{11}$/.test(raw.slice(0, 11)) ? raw.slice(0, 11) : null);
    if (host === "youtu.be") return id(url.pathname.slice(1));
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v) return id(v);
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a link
  }
  return null;
}

/** YouTube titles are long: keep the part before the first separator or emoji. */
export function shortTitle(title: string) {
  const first = title.split(/\s[|•–—-]\s|[|•【\[(]|\p{Extended_Pictographic}/u)[0].trim();
  return (first || title).slice(0, 60).trim();
}

/** 3:02:14 / 45:10 */
export function formatLength(seconds: number | null) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
