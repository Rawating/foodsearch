import Link from "next/link";
import Image from "next/image";
import HeartButton from "./HeartButton";

export default function RecipeCard({ recipe }) {
  const meta = [recipe.category, recipe.area].filter(Boolean).join(" · ");
  return (
    <Link href={`/recipe/${encodeURIComponent(recipe.id)}`} className="ticket">
      <HeartButton recipe={recipe} className="heart-on-card" />
      {recipe.image ? (
        <Image
          className="ticket-img"
          src={recipe.image}
          alt={recipe.title}
          width={320}
          height={240}
        />
      ) : (
        <div className="ticket-img" />
      )}
      <div className="ticket-body">
        <p className="ticket-meta">{meta || recipe.providerId}</p>
        <h3 className="ticket-title">{recipe.title}</h3>
      </div>
    </Link>
  );
}