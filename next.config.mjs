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
    return [{ source: "/options/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};

export default nextConfig;
