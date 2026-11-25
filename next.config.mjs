/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, outputFileTracingIncludes: { "/api/**/*": ["./schedule-data/**/*.json.gz"] } };
export default nextConfig;
