import { NextResponse } from "next/server";
import { getRecipe } from "@/lib/providers";

// GET /api/recipe/themealdb:52772
export async function GET(_request, { params }) {
  const id = decodeURIComponent(params.id);
  const recipe = await getRecipe(id);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }
  return NextResponse.json({ recipe });
}
