import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "spbyjpecncuoztwpfkms.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  // Keep a single canonical host (matches siteOrigin / sitemap).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.screenshot.design" }],
        destination: "https://screenshot.design/:path*",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
