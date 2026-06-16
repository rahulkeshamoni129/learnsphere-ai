import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep xenova external so Vercel doesn't try to bundle its native binaries.
  // On Vercel we use HF Inference API instead (see src/lib/embeddings.ts).
  serverExternalPackages: ["@xenova/transformers", "pdf-parse"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/pdf-parse/lib/**/*.js"]
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ];
  }
};

export default nextConfig;
