/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  experimental: {
    // FlowBoard API routes use Prisma with a custom client output
    // (src/generated/prisma). Next's file tracing does not follow the
    // runtime-loaded query engine binary, so include it explicitly — without
    // this, Vercel Lambdas fail with "Prisma Client could not locate the
    // Query Engine for runtime \"rhel-openssl-3.0.x\"".
    outputFileTracingIncludes: {
      '/api/flowboard/**': ['./src/generated/prisma/*.node'],
    },
  },
};

module.exports = nextConfig;
