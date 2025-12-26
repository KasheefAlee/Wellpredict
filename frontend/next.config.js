/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Expose API base URL to the client; prefer NEXT_PUBLIC_API_URL but fall back to API_URL or default
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:5000/api',
  },
};

module.exports = nextConfig;

