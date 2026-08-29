import type { Metadata } from "next"
import { LoginPage } from "@/views/LoginPage"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Screenshot Studio to create and save projects.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
}

export default function LoginRoute() {
  return <LoginPage />
}
