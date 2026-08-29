import type { Metadata } from "next"
import { LegalPage } from "@/views/LegalPage"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Screenshot Studio — how we handle accounts, projects, and billing.",
  alternates: { canonical: "/privacy" },
}

export default function PrivacyRoute() {
  return <LegalPage doc="privacy" />
}
