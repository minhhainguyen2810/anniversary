import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: Request) {
  if (!isSupabaseConfigured() || !process.env.PEXELS_API_KEY) return NextResponse.json({ photos: [] });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const page = new URL(request.url).searchParams.get("page") ?? "1";
  const response = await fetch(`https://api.pexels.com/v1/search?query=beautiful%20landscape%20nature&orientation=portrait&size=large&per_page=12&page=${encodeURIComponent(page)}`, {
    headers: { Authorization: process.env.PEXELS_API_KEY },
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ photos: [], error: "Background service unavailable" }, { status: 200 });
  const payload = await response.json() as { photos?: Array<{ id: number; photographer: string; photographer_url: string; url: string; alt: string; src: { portrait?: string; landscape?: string; large2x?: string } }> };
  return NextResponse.json({ photos: (payload.photos ?? []).map((photo) => ({ id: photo.id, portrait: photo.src.portrait ?? photo.src.large2x, landscape: photo.src.landscape ?? photo.src.large2x, photographer: photo.photographer, photographerUrl: photo.photographer_url, pageUrl: photo.url, alt: photo.alt || "A beautiful landscape" })) });
}
