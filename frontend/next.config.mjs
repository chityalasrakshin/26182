/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/landing',
        destination: '/landing.html',
      },
      {
        source: '/docs',
        destination: '/docs.html',
      },
      {
        source: '/docs/:path*',
        destination: '/docs.html',
      },
    ];
  },
};

export default nextConfig;
