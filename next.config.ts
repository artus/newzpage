import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev server only serves its scripts to origins it knows. Add the names you open it under on your LAN.
  allowedDevOrigins: ["neo", "neo.local", "*.local"],
  // Keep the DOM implementation out of the server bundle; it is only used at request time.
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
  // feeds.json is read by path at request time, so tracing would not see it; include it by hand.
  outputFileTracingIncludes: { "/api/defaults": ["./feeds.json"] },
};

export default nextConfig;
