import type { Metadata } from "next"
import { HomePage } from "@/views/HomePage"
import { siteOrigin } from "@/config"
import { HOME_FAQS } from "@/lib/home-faq"

const origin = siteOrigin()

export const metadata: Metadata = {
  title: "App Store & Play Store screenshot designer",
  description:
    "Create polished App Store and Google Play screenshots with templates, device frames, and multi-size exports. Thousands of store screens designed. Free to start.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Screenshot Studio — App Store & Play screenshots",
    description:
      "Design store-ready screenshots once, export every size. Templates for iPhone, iPad, and Google Play.",
    url: origin,
  },
}

const softwareJsonLd = {
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

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOME_FAQS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
}

export default function HomeRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HomePage />
    </>
  )
}
