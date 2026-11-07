import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Make sure the fixtures file ships with the serverless MCP route.
  outputFileTracingIncludes: { "/api/[transport]": ["./data/**/*"] },
};

export default nextConfig;
