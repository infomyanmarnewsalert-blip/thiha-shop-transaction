import type React from "react"
import { Montserrat, Open_Sans } from "next/font/google"
import "./globals.css"
import GlobalLoadingOverlay from "@/components/GlobalLoadingOverlay";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["400", "600", "700", "900"],
})

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-open-sans",
  weight: ["400", "500", "600"],
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className={`${montserrat.variable} ${openSans.variable} antialiased`}>
      <body className="font-sans">
        {children}
        <GlobalLoadingOverlay />
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
