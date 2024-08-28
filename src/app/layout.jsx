import { Inter } from "next/font/google";
import Head from "next/head";
import ThemeSelector from "./components/themeSelector";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Shareify",
  description: "파일들을 편리하게 공유하세요",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
      </Head>
      <body className={inter.className}>
        <ThemeSelector />
        {children}
      </body>
    </html>
  );
}
