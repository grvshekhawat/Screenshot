import type { Metadata } from "next"
import { LegalPage } from "@/views/LegalPage"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Screenshot Studio — App Store and Play screenshot designer.",
  alternates: { canonical: "/terms" },
}

export default function TermsRoute() {
  return <LegalPage doc="terms" />
}
