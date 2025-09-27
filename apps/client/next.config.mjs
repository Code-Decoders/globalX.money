/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cryptologos.cc',
                pathname: '/logos/**',
            },
            {
                protocol: 'https',
                hostname: 'flagcdn.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'assets-currency.kucoin.com',
                pathname: '/**',
            },
        ],
    },
};

export default nextConfig;
