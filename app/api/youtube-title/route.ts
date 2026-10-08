import { NextResponse } from 'next/server';

// A YouTube video's title, for naming tracks in the study playlist.
// Uses YouTube's public oEmbed lookup, which needs no key.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^[\w-]{11}$/.test(id)) return NextResponse.json({ error: 'Not a YouTube video id' }, { status: 400 });
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
    if (!res.ok) return NextResponse.json({ error: "Couldn't find that video" }, { status: 404 });
    const data = await res.json();
    return NextResponse.json({ title: String(data.title ?? '') });
  } catch {
    return NextResponse.json({ error: "Couldn't reach YouTube" }, { status: 502 });
  }
}
