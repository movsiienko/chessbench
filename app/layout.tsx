import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"

import "./globals.css"
// Must stay after globals.css. text-colors.css re-declares nine foreground
// tokens that globals.css already sets, and neither file is layered, so the
// later import wins on source order alone. Reordering these two lines silently
// reverts every override in it - the theme changes and nothing fails to build.
import "./text-colors.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "ChessBench - LLM chess benchmark",
  description: "A shadcn dashboard for comparing LLM chess puzzle performance.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "development" && (
          <>
            {/* impeccable-live-start */}
            <Script
              src="http://localhost:8400/live.js"
              strategy="afterInteractive"
            />
            {/* impeccable-live-end */}
          </>
        )}
      </body>
    </html>
  )
}
