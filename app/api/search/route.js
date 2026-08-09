import { NextResponse } from "next/server";
import { searchAll } from "@/lib/providers";

// GET /api/search?q=chicken
export async function GET(request) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ recipes: [], errors: [] });
  }
  const { recipes, errors } = await searchAll(q);
  return NextResponse.json({ recipes, errors });
}
