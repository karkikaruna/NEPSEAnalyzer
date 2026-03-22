const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/nepse/:path*',
        destination: 'http://localhost:8000/nepse/:path*',
      },
    ];
  },
};
module.exports = nextConfig;
