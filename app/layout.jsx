import "./globals.css";
import Link from "next/link";
import { FavoritesProvider } from "@/components/FavoritesProvider";

export const metadata = {
  title: "PantryUp",
  description: "Find recipes based on the ingredients you have or browse by category.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts load in the browser, so the build needs no font network access.
            Swap to next/font later if you want self-hosted, zero-layout-shift fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <FavoritesProvider>
          <div
            aria-hidden="true"
            style={{ position: "fixed", inset: 0, zIndex: -1, overflow: "hidden", pointerEvents: "none" }}
          >
            <img src="/image.png"  alt="" style={{ position: "absolute", width: "140px", opacity: 0.12, top: "6%",  left: "5px", transform: "rotate(-10deg)" }} />
            <img src="/image1.png" alt="" style={{ position: "absolute", width: "150px", opacity: 0.12, top: "42%", right: "-20px", transform: "rotate(8deg)" }} />
            <img src="/image2.png" alt="" style={{ position: "absolute", width: "130px", opacity: 0.12, bottom: "5%", left: "7%", transform: "rotate(6deg)" }} />
            <img src="/image3.png" alt="" style={{ position: "absolute", width: "110px", opacity: 0.12, top: "22%", right: "11%", transform: "rotate(-5deg)" }} />
          </div>
          <Link href="/favorites" className="saved-link">♥ Saved</Link>
          {children}
        </FavoritesProvider>
      </body>
    </html>
  );
}