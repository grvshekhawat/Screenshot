import {
  MARKETING_DISPLAY,
  MarketingHeader,
} from "../components/MarketingHeader"
import { SiteFooter, SUPPORT_EMAIL } from "../components/SiteFooter"

const EFFECTIVE = "August 29, 2026"

type Doc = "terms" | "privacy"

const copy: Record<
  Doc,
  { title: string; sections: { heading: string; body: string[] }[] }
> = {
  terms: {
    title: "Terms of Service",
    sections: [
      {
        heading: "Agreement",
        body: [
          "These Terms of Service (“Terms”) govern your access to and use of Screenshot Studio (the “Service”), including the website, editor, templates, and related features. By creating an account or using the Service, you agree to these Terms.",
          "If you do not agree, do not use the Service.",
        ],
      },
      {
        heading: "The Service",
        body: [
          "Screenshot Studio helps you design App Store and Google Play marketing screenshots. You may browse published templates without an account. Creating, saving, and editing projects requires an account.",
          "Free accounts may create a limited number of projects and export watermarked PNG previews. A paid Pro subscription unlocks clean PNG and ZIP exports as described on the Pricing page.",
        ],
      },
      {
        heading: "Accounts",
        body: [
          "You are responsible for your account credentials and for activity under your account. Provide accurate information and keep your password secure.",
          "We may suspend or terminate accounts that abuse the Service, violate these Terms, or create risk for other users or our systems.",
        ],
      },
      {
        heading: "Your content",
        body: [
          "You retain ownership of screenshots, assets, and designs you upload or create (“Your Content”). You grant us a limited license to host, process, and display Your Content solely to operate and improve the Service (for example, saving projects and generating thumbnails or exports).",
          "You represent that you have the rights needed to upload and use Your Content, and that it does not infringe others’ rights or violate law.",
          "You are responsible for complying with Apple, Google, and other platform policies when you publish store screenshots created with the Service.",
        ],
      },
      {
        heading: "Subscriptions and billing",
        body: [
          "Pro is billed through our payment processor (currently Stripe) at the price shown at checkout (currently $1.99 per month unless otherwise stated). Taxes may apply.",
          "Subscriptions renew until canceled. You can manage or cancel through the billing portal linked from Pricing. If you cancel, Pro features generally remain available until the end of the current paid period.",
          "Fees are generally non-refundable except where required by law or expressly offered by us.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Do not misuse the Service: no unauthorized access, scraping that harms the Service, malware, spam, or attempts to bypass project limits, watermarks, or paywalls.",
          "Do not upload illegal content or content you do not have rights to use.",
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          "The Service, branding, built-in templates, and software are owned by us or our licensors. Except for Your Content and the limited rights granted to you to use the Service, no rights are transferred.",
        ],
      },
      {
        heading: "Disclaimer and limitation of liability",
        body: [
          "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
          "TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL. OUR TOTAL LIABILITY FOR CLAIMS RELATED TO THE SERVICE IS LIMITED TO THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE THREE MONTHS BEFORE THE CLAIM.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "We may update the Service and these Terms. Continued use after changes become effective constitutes acceptance of the updated Terms. Material changes may be highlighted on the site or by email when appropriate.",
        ],
      },
      {
        heading: "Contact",
        body: [`Questions about these Terms: ${SUPPORT_EMAIL}`],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Overview",
        body: [
          "This Privacy Policy explains how Screenshot Studio (“we”, “us”) collects, uses, and shares information when you use our website and Service.",
          `Effective date: ${EFFECTIVE}. Contact: ${SUPPORT_EMAIL}.`,
        ],
      },
      {
        heading: "Information we collect",
        body: [
          "Account information: email address and authentication data when you sign up (handled via our auth provider).",
          "Project data: designs, uploads (such as screenshots and clipart), and settings you save in projects.",
          "Billing information: payment is processed by Stripe. We receive subscription status and related billing identifiers; we do not store full card numbers.",
          "Usage data: basic logs such as timestamps, feature errors, and IP-related security signals may be processed by our hosting and infrastructure providers.",
        ],
      },
      {
        heading: "How we use information",
        body: [
          "To provide and operate the Service (accounts, saving projects, exports, templates).",
          "To process subscriptions and prevent fraud or abuse.",
          "To communicate about the Service (for example, account or billing notices).",
          "To improve reliability and security.",
        ],
      },
      {
        heading: "Sharing",
        body: [
          "We share data with processors that help us run the Service, including hosting/auth/storage (e.g. Supabase) and payments (Stripe), under contracts that limit their use of the data.",
          "We may disclose information if required by law or to protect rights, safety, and security.",
          "We do not sell your personal information.",
        ],
      },
      {
        heading: "Retention",
        body: [
          "We keep account and project data while your account is active and as needed to operate the Service. You may delete projects in the app. You can request account deletion by contacting support.",
          "Billing records may be retained as required for accounting and legal obligations.",
        ],
      },
      {
        heading: "Security",
        body: [
          "We use industry-standard measures appropriate to our Service (encrypted transport, access controls). No method of transmission or storage is completely secure.",
        ],
      },
      {
        heading: "Children",
        body: [
          "The Service is not directed to children under 16, and we do not knowingly collect personal information from them.",
        ],
      },
      {
        heading: "Your choices",
        body: [
          "You can access and update account email via your auth provider flows where available, manage projects in the app, and manage billing via the Stripe customer portal.",
          `For access, correction, or deletion requests, email ${SUPPORT_EMAIL}.`,
        ],
      },
      {
        heading: "International users",
        body: [
          "The Service may be hosted in the United States or other regions. By using the Service, you understand your information may be processed in countries that may have different data-protection laws than your own.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "We may update this Privacy Policy from time to time. We will post the updated version on this page with a revised effective date.",
        ],
      },
    ],
  },
}

export function LegalPage({ doc }: { doc: Doc }) {
  const page = copy[doc]
  return (
    <div className="flex min-h-full flex-col bg-[#07070a] text-zinc-100">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-14">
        <p className="text-[12px] tracking-wide text-zinc-500">
          Effective {EFFECTIVE}
        </p>
        <h1
          className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl"
          style={{ fontFamily: MARKETING_DISPLAY }}
        >
          {page.title}
        </h1>
        <div className="mt-10 space-y-9">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2
                className="text-lg font-semibold tracking-tight text-zinc-100"
                style={{ fontFamily: MARKETING_DISPLAY }}
              >
                {section.heading}
              </h2>
              <div className="mt-2.5 space-y-3 text-[14px] leading-relaxed text-zinc-400">
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-12 border-t border-white/[0.06] pt-6 text-xs text-zinc-600">
          These documents are provided for transparency and are not a substitute
          for legal advice. If you need counsel for your jurisdiction, consult a
          lawyer.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
