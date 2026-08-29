import type { Metadata } from "next"
import { PricingPage } from "@/views/PricingPage"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free App Store screenshot editor with watermarked PNG previews. Pro ($1.99/mo) unlocks clean PNG and multi-size ZIP exports for iPhone, iPad, and Google Play.",
  alternates: { canonical: "/pricing" },
}

export default function PricingRoute() {
  return <PricingPage />
}
