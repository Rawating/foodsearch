/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Recipe thumbnails are hosted on the providers' own CDNs.
    // Add a new provider's image host here when you plug one in.
    remotePatterns: [
      { protocol: "https", hostname: "www.themealdb.com" },
    ],
  },
};

export default nextConfig;
