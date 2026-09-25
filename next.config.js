/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Windows + antivirus real-time scanning frequently locks the webpack
    // persistent cache's .pack.gz files mid-rename (ENOENT), corrupting the
    // dev build and causing pages/navigation to silently stop working until
    // .next is deleted. Disabling the on-disk cache in dev trades a little
    // rebuild speed for not hitting this.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
