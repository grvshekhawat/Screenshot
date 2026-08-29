import type { Metadata } from "next"
import { HomePage } from "@/views/HomePage"
import { siteOrigin } from "@/config"

const origin = siteOrigin()

export const metadata: Metadata = {
  title: "App Store & Play Store screenshot designer",
  description:
    "Create App Store and Google Play marketing screenshots with templates, device frames, and multi-size ZIP exports. Free to start; Pro for clean exports.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Screenshot Studio — App Store & Play screenshots",
    description:
      "Design store screenshots with templates and export multi-size ZIP packs.",
    url: origin,
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Screenshot Studio",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  url: origin,
  description:
    "Design App Store and Google Play marketing screenshots with templates and multi-size exports.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free plan with watermarked exports; Pro from $1.99/month",
  },
}

export default function HomeRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage />
    </>
  )
}
