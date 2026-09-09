/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', '@elastic/elasticsearch'],
  },
  webpack: (config, { dev }) => {
    // This project lives inside a OneDrive-synced folder on Windows —
    // OneDrive's sync process races webpack's persistent disk cache
    // (.next/cache/webpack/**/*.pack.gz), intermittently corrupting or
    // deleting pack files mid-write. That surfaces as ENOENT/EINVAL crashes
    // on `next dev` (sometimes on cache reads, sometimes later as
    // `.next\package.json` becoming an unreadable reparse point that
    // `next dev`'s own cleanup can't delete, forcing a full `.next` wipe).
    // Disabling the disk cache in dev trades some rebuild speed for not
    // hitting this — the correctness fix is moving the project outside
    // OneDrive sync, this is just removing the most common trigger.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
