// The Photos stage (Eryk, 26 Nov; mockup v129). The app runs in Arc (Chromium) and works directly in the
// OS Photos folder on the Mac (dev/apps/OS Photos): photos are dragged into OS Photos/Inbox, grouped by
// when they were taken, and sorted into OS Photos/<item code> as JPGs. Nothing is uploaded anywhere.
// Browser only. The folder is chosen once and remembered (IndexedDB); Arc may ask to allow it again.

type Dir = FileSystemDirectoryHandle;
type Perm = "granted" | "denied" | "prompt";
const PERM = { mode: "readwrite" } as const;

// ---------- remembering the folder ----------

const DB = "os-stock", STORE = "kv", KEY = "photo-dir";
function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = run(open.result.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}

export type FolderState = { state: "none" } | { state: "ask"; dir: Dir } | { state: "ok"; dir: Dir };

/** Where we stand with the OS Photos folder: never chosen, chosen but Arc wants an OK, or ready. */
export async function photoFolder(): Promise<FolderState> {
  const dir = await idb<Dir | undefined>("readonly", (s) => s.get(KEY)).catch(() => undefined);
  if (!dir) return { state: "none" };
  const p: Perm = await (dir as any).queryPermission(PERM);
  return p === "granted" ? { state: "ok", dir } : { state: "ask", dir };
}

/** First time: pick OS Photos (must be called from a click). Makes Inbox inside it if it's missing. */
export async function chooseFolder(): Promise<Dir> {
  const dir: Dir = await (window as any).showDirectoryPicker({ id: "os-photos", mode: "readwrite" });
  await dir.getDirectoryHandle("Inbox", { create: true });
  await idb("readwrite", (s) => s.put(dir, KEY));
  return dir;
}

/** Later: Arc asks for an OK again (must be called from a click). */
export async function allowFolder(dir: Dir): Promise<boolean> {
  return (await (dir as any).requestPermission(PERM)) === "granted";
}

export const photosSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

// ---------- reading the Inbox ----------

export interface InboxPhoto {
  name: string;   // file name in Inbox
  taken: number;  // when it was taken (ms), from the photo itself, else the file date
  jpg: Blob;      // what gets saved: HEIC converted to JPG (quality 95%), JPGs as they are
  url: string;    // for showing it
}

const IMAGE = /\.(heic|heif|jpe?g|png)$/i;
const isHeicName = (n: string) => /\.(heic|heif)$/i.test(n);

/** Reads every photo in OS Photos/Inbox, oldest first. `onProgress` gets (done, total). */
export async function readInbox(dir: Dir, onProgress?: (done: number, total: number) => void): Promise<InboxPhoto[]> {
  const inbox = await dir.getDirectoryHandle("Inbox", { create: true });
  const files: File[] = [];
  for await (const [name, h] of (inbox as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (h.kind === "file" && IMAGE.test(name) && !name.startsWith(".")) files.push(await (h as FileSystemFileHandle).getFile());
  }
  const [{ heicTo }, exifr] = await Promise.all([import("heic-to/next"), import("exifr")]);
  const out: InboxPhoto[] = [];
  let done = 0;
  onProgress?.(0, files.length);
  for (const f of files) {
    let taken = f.lastModified;
    try {
      const meta = await exifr.parse(f, { pick: ["DateTimeOriginal", "CreateDate"] });
      const d = meta?.DateTimeOriginal ?? meta?.CreateDate;
      if (d instanceof Date && !isNaN(d.getTime())) taken = d.getTime();
    } catch { /* keep the file date */ }
    const jpg = isHeicName(f.name) ? await heicTo({ blob: f, type: "image/jpeg", quality: 0.95 }) : f;
    out.push({ name: f.name, taken, jpg, url: URL.createObjectURL(jpg) });
    onProgress?.(++done, files.length);
  }
  return out.sort((a, b) => a.taken - b.taken || a.name.localeCompare(b.name));
}

/** Photos taken close together belong to one item: a gap of more than `gapMin` minutes starts a new group. */
export function groupByTime(photos: InboxPhoto[], gapMin = 3): InboxPhoto[][] {
  const groups: InboxPhoto[][] = [];
  for (const p of photos) {
    const last = groups[groups.length - 1];
    if (last && p.taken - last[last.length - 1].taken <= gapMin * 60_000) last.push(p);
    else groups.push([p]);
  }
  return groups;
}

// ---------- sorting into item folders ----------

/** Saves each group into OS Photos/<folder> as <folder>-01.jpg, -02.jpg… (after any already there), then removes the originals from Inbox. */
export async function sortGroups(dir: Dir, groups: { folder: string; photos: InboxPhoto[] }[]) {
  const inbox = await dir.getDirectoryHandle("Inbox", { create: true });
  for (const g of groups) {
    const itemDir = await dir.getDirectoryHandle(g.folder, { create: true });
    let n = 0;
    for await (const [name] of (itemDir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) if (/\.jpe?g$/i.test(name)) n++;
    for (const p of g.photos) {
      const file = await itemDir.getFileHandle(`${g.folder}-${String(++n).padStart(2, "0")}.jpg`, { create: true });
      const w = await (file as any).createWritable();
      await w.write(p.jpg);
      await w.close();
      await inbox.removeEntry(p.name);
    }
  }
}

/** The JPGs in an item's folder, in order (for its Photos tab). Empty if the folder isn't there. */
export async function itemPhotos(dir: Dir, folder: string): Promise<{ name: string; url: string }[]> {
  let itemDir: Dir;
  try { itemDir = await dir.getDirectoryHandle(folder); } catch { return []; }
  const out: { name: string; url: string }[] = [];
  for await (const [name, h] of (itemDir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (h.kind === "file" && /\.(jpe?g|png)$/i.test(name)) out.push({ name, url: URL.createObjectURL(await (h as FileSystemFileHandle).getFile()) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
