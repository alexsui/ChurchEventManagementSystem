import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Always put generateMetadata output in <head> (no streaming metadata), so link previews
  // (e.g. LINE, which is not in Next's default bot list) show the event / activity name.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
