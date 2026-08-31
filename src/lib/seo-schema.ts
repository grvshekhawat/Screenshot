import { siteOrigin } from "@/config"

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
) {
  const origin = siteOrigin()
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path === "/" ? origin : `${origin}${item.path}`,
    })),
  }
}

export function publisherJsonLd() {
  const origin = siteOrigin()
  return {
    "@type": "Organization",
    name: "Screenshot Studio",
    url: origin,
    logo: {
      "@type": "ImageObject",
      url: `${origin}/og.png`,
    },
  }
}
