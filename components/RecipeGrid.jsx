import RecipeCard from "./RecipeCard";

export default function RecipeGrid({ recipes }) {
  if (!recipes?.length) return null;
  return (
    <div className="grid">
      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
    </div>
  );
}
