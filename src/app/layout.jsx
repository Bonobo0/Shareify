import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Header from "./components/header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Shareify",
  description: "파일들을 편리하게 공유하세요",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <AuthProvider>
          <Header />
          <main className="pt-16">
            {" "}
            {/* 헤더 높이만큼 상단 패딩 추가 */}
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
