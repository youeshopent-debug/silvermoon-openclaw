import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { LocaleProvider } from "@/lib/i18n"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "🤖 AI Automation Agency | SilverMoon Bank 银月钱庄",
  description: "Enterprise-grade AI automation, webhook pipelines, and multi-agent orchestration for modern businesses. AI 自动化工作流 · 多智能体编排 · Web3 网关",
  keywords: ["AI Automation", "Multi-Agent", "Webhook", "Discord Bot", "SilverMoon", "银月钱庄"],
  openGraph: {
    title: "SilverMoon Bank | AI Automation Agency",
    description: "Enterprise AI automation, webhook pipelines, and multi-agent orchestration.",
    type: "website",
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="scroll-smooth">
      <body className={inter.className}>
        <LocaleProvider>
          {children}
        </LocaleProvider>
      </body>
    </html>
  )
}
