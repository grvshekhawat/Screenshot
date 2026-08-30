import type { Metadata } from "next"
import { Providers } from "@/components/Providers"
import { siteOrigin } from "@/config"
import "./globals.css"

const origin = siteOrigin()

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: "Screenshot Studio — App Store & Play screenshots",
    template: "%s · Screenshot Studio",
  },
  description:
    "Design App Store and Google Play marketing screenshots with templates, device frames, and multi-size ZIP exports. Free to create; Pro for clean exports.",
  applicationName: "Screenshot Studio",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: origin,
    siteName: "Screenshot Studio",
    title: "Screenshot Studio — App Store & Play screenshots",
    description:
      "Design App Store and Google Play marketing screenshots with templates, device frames, and multi-size ZIP exports.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Screenshot Studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Screenshot Studio — App Store & Play screenshots",
    description:
      "Design App Store and Google Play marketing screenshots with templates, device frames, and multi-size ZIP exports.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=Inter:wght@400;600;700&family=Lato:wght@400;700&family=Montserrat:wght@500;600;700&family=Open+Sans:wght@400;600;700&family=Outfit:wght@500;600;700&family=Playfair+Display:wght@600;700&family=Poppins:wght@500;600;700&family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
