import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev server only serves its scripts to origins it knows. Add the names you open it under on your LAN.
  allowedDevOrigins: ["neo", "neo.local", "*.local"],
  // Keep the DOM implementation out of the server bundle; it is only used at request time.
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
  // Files read by path at request time: the house defaults, and the faces the cutting's preview image is drawn
  // with. The image module spells its paths out, so tracing finds them; listing them here keeps that explicit.
  outputFileTracingIncludes: { "/api/defaults": ["./feeds.json"], "/story/image": ["./src/fonts/*.ttf"] },
};

export default nextConfig;
