import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/providers";
import AskAi from "@/components/AskAi";
import HeartButton from "@/components/HeartButton";

export default async function RecipePage({ params }) {
  const id = decodeURIComponent(params.id);
  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  const meta = [recipe.category, recipe.area].filter(Boolean);

  return (
    <div className="shell">
      <Link href="/" className="back">
        ← Back to search
      </Link>

      <div className="detail-head">
        {recipe.image ? (
          <Image
            className="detail-img"
            src={recipe.image}
            alt={recipe.title}
            width={640}
            height={640}
          />
        ) : (
          <div className="detail-img" />
        )}

        <div>
          <div className="detail-title-row">
            <h1 className="detail-title">{recipe.title}</h1>
            <HeartButton recipe={recipe} className="heart-on-detail" />
          </div>
          <p className="tagline">
            {meta.length > 0 ? (
              <>
                <b>{recipe.category}</b>
                {recipe.area ? ` · ${recipe.area}` : ""}
              </>
            ) : (
              recipe.providerId
            )}
            {recipe.tags.length > 0 && ` · ${recipe.tags.join(", ")}`}
          </p>

          {recipe.ingredients.length > 0 && (
            <>
              <p className="section-label">Ingredients</p>
              <ul className="ingredients">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.measure && <span className="measure">{ing.measure}</span>}
                    {ing.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {recipe.instructions && (
        <>
          <p className="section-label">Method</p>
          <div className="instructions">{recipe.instructions}</div>
        </>
      )}

      <div className="links">
        {recipe.sourceUrl && (
          <a className="btn" href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            Original source
          </a>
        )}
        {recipe.youtubeUrl && (
          <a className="btn" href={recipe.youtubeUrl} target="_blank" rel="noreferrer">
            Watch on YouTube
          </a>
        )}
      </div>

      <AskAi recipe={recipe} />
    </div>
  );
}
