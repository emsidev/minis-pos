import withSerwistInit from "@serwist/next"

const withSerwist = withSerwistInit({
  disable: process.env.NODE_ENV === "development",
  swDest: "public/sw.js",
  swSrc: "app/sw.ts",
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "eicdazlrqmfnvqornwal.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)
