import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Make sure the fixtures file ships with the serverless MCP route.
  outputFileTracingIncludes: { "/api/[transport]": ["./data/**/*"], "/api/agenda.pdf": ["./data/**/*"] },
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
