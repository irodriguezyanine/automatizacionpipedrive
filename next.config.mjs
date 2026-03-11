/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Evita fallos en "Collecting build traces" en Vercel
  experimental: {
    serverComponentsExternalPackages: ['@aws-sdk/client-ses'],
  },
}

export default nextConfig
