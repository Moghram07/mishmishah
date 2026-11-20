/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root — a stray parent lockfile would otherwise confuse tracing.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  /*
    The phone panel's option pictures: every URL carries the picture's own
    hash (`lib/visualizer/optionPictures.ts`), so a phone keeps each for good
    and fetches it again only when it is redrawn under a new hash.
  */
  async headers() {
    const forGood = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    // each URL carries its file's hash (?v=): kept for good, fetched again only when remade
    return [
      { source: "/options/:path*", headers: forGood },
      { source: "/mannequin/tinted/:path*", headers: forGood },
    ];
  },
};

export default nextConfig;
