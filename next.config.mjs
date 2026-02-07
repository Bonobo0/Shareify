/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production 환경에서 console 제거
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error"], // console.error는 production에서도 유지
          }
        : false,
  },
  // ESLint 설정
  eslint: {
    // 빌드 시 ESLint 오류가 있어도 빌드를 계속 진행
    ignoreDuringBuilds: true,
  },
  // TypeScript 설정
  typescript: {
    // 빌드 시 TypeScript 오류가 있어도 빌드를 계속 진행
    ignoreBuildErrors: true,
  },
  // Server Actions origin 검증 설정
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.app.github.dev"],
    },
  },
};

export default nextConfig;
