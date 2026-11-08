/** @type {import('next').NextConfig} */
const nextConfig = {
  // The guides section was drafted as /blog; send any old or shared /blog links to /guides.
  async redirects() {
    return [
      { source: '/blog', destination: '/guides', permanent: true },
      { source: '/blog/:slug', destination: '/guides/:slug', permanent: true }
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' }
    ]
  }
};
module.exports = nextConfig;
