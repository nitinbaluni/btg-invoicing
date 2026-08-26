/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["puppeteer", "@prisma/client"],
  },
};

module.exports = nextConfig;
