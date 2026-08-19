/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', '@elastic/elasticsearch'],
  },
};

module.exports = nextConfig;
