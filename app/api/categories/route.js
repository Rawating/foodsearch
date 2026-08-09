import { NextResponse } from "next/server";
import { listAllCategories, searchByCategory } from "@/lib/providers";

// GET /api/categories            -> list of category names
// GET /api/categories?c=Seafood  -> recipe stubs in that category
export async function GET(request) {
  const c = request.nextUrl.searchParams.get("c")?.trim();
  if (c) {
    const recipes = await searchByCategory(c);
    return NextResponse.json({ recipes });
  }
  const categories = await listAllCategories();
  return NextResponse.json({ categories });
}
