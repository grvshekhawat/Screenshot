/** Built-in mock phone UIs for catalog templates (SVG data URLs). */

export type SampleScreen = {
  id: string
  dataUrl: string
}

const W = 390
const H = 844

function svgDataUrl(body: string): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

function statusBar(fg = "#18181b") {
  return `
    <text x="28" y="28" fill="${fg}" font-size="13" font-family="system-ui,sans-serif" font-weight="600">9:41</text>
    <circle cx="340" cy="24" r="5" fill="${fg}" opacity="0.35"/>
    <rect x="350" y="18" width="22" height="12" rx="3" fill="none" stroke="${fg}" stroke-width="1.5" opacity="0.5"/>
  `
}

function homeIndicator(fg = "#18181b", opacity = 0.2) {
  return `<rect x="145" y="822" width="100" height="5" rx="2.5" fill="${fg}" opacity="${opacity}"/>`
}

function card(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  r = 18,
) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`
}

function beautyScreen(
  id: string,
  opts: { title: string; subtitle: string; accent: string; cards: string[] },
): SampleScreen {
  const chips = opts.cards
    .slice(0, 4)
    .map((label, i) => {
      const y = 210 + i * 130
      return `
        ${card(24, y, 342, 112, "#ffffff")}
        <rect x="40" y="${y + 20}" width="72" height="72" rx="16" fill="${opts.accent}" opacity="0.2"/>
        <circle cx="76" cy="${y + 56}" r="18" fill="${opts.accent}" opacity="0.55"/>
        <text x="132" y="${y + 48}" fill="#18181b" font-size="17" font-family="system-ui,sans-serif" font-weight="700">${label}</text>
        <text x="132" y="${y + 72}" fill="#71717a" font-size="13" font-family="system-ui,sans-serif">From $24 · 4.${5 + (i % 4)}★</text>
        <rect x="300" y="${y + 40}" width="44" height="32" rx="10" fill="${opts.accent}"/>
      `
    })
    .join("")
  return {
    id,
    dataUrl: svgDataUrl(`
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5f3ff"/>
          <stop offset="100%" stop-color="#fdf2f8"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      ${statusBar("#3f3f46")}
      <text x="28" y="78" fill="#18181b" font-size="28" font-family="system-ui,sans-serif" font-weight="800">${opts.title}</text>
      <text x="28" y="108" fill="#71717a" font-size="14" font-family="system-ui,sans-serif">${opts.subtitle}</text>
      <rect x="24" y="130" width="342" height="44" rx="22" fill="#ffffff"/>
      <text x="48" y="158" fill="#a1a1aa" font-size="14" font-family="system-ui,sans-serif">Search products</text>
      ${chips}
      ${homeIndicator()}
    `),
  }
}

function listenScreen(
  id: string,
  opts: { title: string; artist: string; bars?: boolean },
): SampleScreen {
  const bars = Array.from({ length: 18 }, (_, i) => {
    const h = 20 + ((i * 17) % 48)
    return `<rect x="${48 + i * 16}" y="${520 - h}" width="10" height="${h}" rx="3" fill="#a78bfa"/>`
  }).join("")
  return {
    id,
    dataUrl: svgDataUrl(`
      <rect width="${W}" height="${H}" fill="#09090b"/>
      ${statusBar("#fafafa")}
      <text x="28" y="72" fill="#a1a1aa" font-size="12" font-family="system-ui,sans-serif" letter-spacing="2">NOW PLAYING</text>
      <rect x="70" y="110" width="250" height="250" rx="28" fill="#1c1917"/>
      <rect x="95" y="135" width="200" height="200" rx="20" fill="#4c1d95"/>
      <circle cx="195" cy="235" r="48" fill="#7c3aed"/>
      <text x="195" y="400" text-anchor="middle" fill="#fafafa" font-size="22" font-family="system-ui,sans-serif" font-weight="800">${opts.title}</text>
      <text x="195" y="428" text-anchor="middle" fill="#a1a1aa" font-size="14" font-family="system-ui,sans-serif">${opts.artist}</text>
      <rect x="48" y="470" width="294" height="4" rx="2" fill="#27272a"/>
      <rect x="48" y="470" width="180" height="4" rx="2" fill="#a78bfa"/>
      ${opts.bars === false ? "" : bars}
      <circle cx="195" cy="620" r="36" fill="#fafafa"/>
      <polygon points="188,605 188,635 214,620" fill="#09090b"/>
      ${homeIndicator("#fafafa", 0.35)}
    `),
  }
}

function searchScreen(
  id: string,
  opts: { query: string; results: string[]; accent: string },
): SampleScreen {
  const rows = opts.results
    .map((label, i) => {
      const y = 200 + i * 96
      return `
        ${card(24, y, 342, 80, "#18181b", 16)}
        <circle cx="60" cy="${y + 40}" r="18" fill="${opts.accent}" opacity="0.85"/>
        <text x="96" y="${y + 36}" fill="#fafafa" font-size="16" font-family="system-ui,sans-serif" font-weight="700">${label}</text>
        <text x="96" y="${y + 58}" fill="#71717a" font-size="12" font-family="system-ui,sans-serif">Trusted answer · ${2 + i}m read</text>
      `
    })
    .join("")
  return {
    id,
    dataUrl: svgDataUrl(`
      <rect width="${W}" height="${H}" fill="#09090b"/>
      ${statusBar("#fafafa")}
      <text x="28" y="78" fill="#fafafa" font-size="26" font-family="Georgia,serif" font-weight="700">Discover</text>
      <rect x="24" y="110" width="342" height="52" rx="16" fill="#18181b" stroke="${opts.accent}" stroke-width="1.5"/>
      <text x="48" y="142" fill="${opts.accent}" font-size="15" font-family="system-ui,sans-serif">${opts.query}</text>
      ${rows}
      ${homeIndicator("#fafafa", 0.35)}
    `),
  }
}

function curatedScreen(
  id: string,
  opts: { title: string; tags: string[]; accent: string },
): SampleScreen {
  const tags = opts.tags
    .map((tag, i) => {
      const x = 24 + (i % 3) * 114
      const y = 520 + Math.floor(i / 3) * 48
      return `
        <rect x="${x}" y="${y}" width="104" height="36" rx="18" fill="#ffffff" opacity="0.22"/>
        <text x="${x + 52}" y="${y + 23}" text-anchor="middle" fill="#ffffff" font-size="13" font-family="system-ui,sans-serif" font-weight="600">${tag}</text>
      `
    })
    .join("")
  return {
    id,
    dataUrl: svgDataUrl(`
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#db2777"/>
          <stop offset="100%" stop-color="#7c3aed"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      ${statusBar("#ffffff")}
      <text x="28" y="90" fill="#ffffff" font-size="13" font-family="system-ui,sans-serif" letter-spacing="1.5">FOR YOU</text>
      <text x="28" y="130" fill="#ffffff" font-size="30" font-family="system-ui,sans-serif" font-weight="800">${opts.title}</text>
      ${card(24, 170, 342, 300, "rgba(255,255,255,0.18)", 28)}
      <rect x="48" y="200" width="140" height="180" rx="20" fill="#ffffff" opacity="0.35"/>
      <rect x="204" y="200" width="140" height="84" rx="18" fill="#ffffff" opacity="0.28"/>
      <rect x="204" y="296" width="140" height="84" rx="18" fill="${opts.accent}" opacity="0.55"/>
      ${tags}
      ${homeIndicator("#ffffff", 0.45)}
    `),
  }
}

/** All sample screenshot assets used by built-in catalog templates. */
export function builtInSampleScreens(): SampleScreen[] {
  return [
    beautyScreen("sample-beauty-1", {
      title: "Essentials",
      subtitle: "Top-rated picks this week",
      accent: "#a78bfa",
      cards: ["Glow serum", "Soft mist", "Daily SPF", "Night cream"],
    }),
    beautyScreen("sample-beauty-2", {
      title: "New brands",
      subtitle: "Loved by 12k shoppers",
      accent: "#f472b6",
      cards: ["Rose oil", "Clay mask", "Lip balm", "Eye gel"],
    }),
    beautyScreen("sample-beauty-3", {
      title: "Simplified",
      subtitle: "Your 3-step routine",
      accent: "#c084fc",
      cards: ["Cleanse", "Treat", "Moisturize", "Protect"],
    }),
    beautyScreen("sample-beauty-4", {
      title: "More beauty",
      subtitle: "Curated just for you",
      accent: "#818cf8",
      cards: ["Hair oil", "Body scrub", "Perfume", "Kit"],
    }),
    beautyScreen("sample-beauty-5", {
      title: "Skincare",
      subtitle: "Level up tonight",
      accent: "#e879f9",
      cards: ["Retinol", "Peptide", "Vitamin C", "Barrier"],
    }),

    listenScreen("sample-listen-1", {
      title: "Morning Brief",
      artist: "Castique Daily",
    }),
    listenScreen("sample-listen-2", {
      title: "Offline Mode",
      artist: "Saved episodes",
      bars: false,
    }),
    listenScreen("sample-listen-3", {
      title: "Story Hour",
      artist: "Keep listening",
    }),
    listenScreen("sample-listen-4", {
      title: "Deep Focus",
      artist: "Instrumental",
    }),
    listenScreen("sample-listen-5", {
      title: "Late Night",
      artist: "Guest series",
    }),

    searchScreen("sample-search-1", {
      query: "What is photosynthesis?",
      accent: "#a3e635",
      results: ["Quick overview", "Key stages", "Why it matters", "Try a quiz"],
    }),
    searchScreen("sample-search-2", {
      query: "Search topics",
      accent: "#bef264",
      results: ["Science", "History", "Tech", "Health"],
    }),
    searchScreen("sample-search-3", {
      query: "Discover feeds",
      accent: "#a3e635",
      results: ["Trending", "For you", "Editors", "Local"],
    }),
    searchScreen("sample-search-4", {
      query: "Get answers",
      accent: "#d9f99d",
      results: ["Cited sources", "Summaries", "Follow-ups", "Saved"],
    }),
    searchScreen("sample-search-5", {
      query: "Trusted picks",
      accent: "#a3e635",
      results: ["Verified", "Peer reviewed", "Expert Q&A", "Guides"],
    }),

    curatedScreen("sample-curated-1", {
      title: "Beauty curated",
      accent: "#f9a8d4",
      tags: ["Stylish", "Luxury", "Unique", "Soft", "Bold", "Clean"],
    }),
    curatedScreen("sample-curated-2", {
      title: "Daily picks",
      accent: "#f472b6",
      tags: ["Glow", "Hydrate", "Calm", "Fresh", "Matte", "Dewy"],
    }),
    curatedScreen("sample-curated-3", {
      title: "Personalized",
      accent: "#e879f9",
      tags: ["Stylish", "Luxury", "Unique", "Vegan", "Clean", "New"],
    }),
    curatedScreen("sample-curated-4", {
      title: "Made simple",
      accent: "#c084fc",
      tags: ["Routine", "Travel", "Gift", "Sale", "Kit", "Tips"],
    }),
    curatedScreen("sample-curated-5", {
      title: "Your shelf",
      accent: "#f9a8d4",
      tags: ["Favorites", "Try", "Restock", "Wishlist", "Notes", "Share"],
    }),

    ...builtInLandscapeScreens(),
  ]
}

/** Public catalog mock UIs — no login or storage required. */
export function sampleScreenDataUrl(assetId: string): string | null {
  return builtInSampleScreens().find((screen) => screen.id === assetId)?.dataUrl ?? null
}

const LW = 844
const LH = 390

function landscapeSvg(body: string): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${LH}" viewBox="0 0 ${LW} ${LH}">${body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

function landStatus(fg = "#18181b") {
  return `
    <text x="28" y="28" fill="${fg}" font-size="13" font-family="system-ui,sans-serif" font-weight="600">9:41</text>
    <circle cx="780" cy="24" r="5" fill="${fg}" opacity="0.35"/>
    <rect x="790" y="18" width="22" height="12" rx="3" fill="none" stroke="${fg}" stroke-width="1.5" opacity="0.5"/>
  `
}

function landscapeBeauty(id: string, title: string, accent: string): SampleScreen {
  return {
    id,
    dataUrl: landscapeSvg(`
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5f3ff"/>
          <stop offset="100%" stop-color="#fdf2f8"/>
        </linearGradient>
      </defs>
      <rect width="${LW}" height="${LH}" fill="url(#bg)"/>
      ${landStatus("#3f3f46")}
      <text x="32" y="78" fill="#18181b" font-size="28" font-family="system-ui,sans-serif" font-weight="800">${title}</text>
      <text x="32" y="108" fill="#71717a" font-size="14" font-family="system-ui,sans-serif">Landscape essentials · curated daily</text>
      ${card(32, 140, 240, 200, "#ffffff")}
      <rect x="52" y="160" width="200" height="120" rx="16" fill="${accent}" opacity="0.25"/>
      <text x="52" y="310" fill="#18181b" font-size="16" font-family="system-ui,sans-serif" font-weight="700">Glow set</text>
      ${card(292, 140, 240, 200, "#ffffff")}
      <rect x="312" y="160" width="200" height="120" rx="16" fill="${accent}" opacity="0.35"/>
      <text x="312" y="310" fill="#18181b" font-size="16" font-family="system-ui,sans-serif" font-weight="700">Soft mist</text>
      ${card(552, 140, 260, 200, "#ffffff")}
      <rect x="572" y="160" width="220" height="120" rx="16" fill="${accent}" opacity="0.45"/>
      <text x="572" y="310" fill="#18181b" font-size="16" font-family="system-ui,sans-serif" font-weight="700">Night cream</text>
    `),
  }
}

function landscapeListen(id: string, title: string, artist: string): SampleScreen {
  return {
    id,
    dataUrl: landscapeSvg(`
      <rect width="${LW}" height="${LH}" fill="#09090b"/>
      ${landStatus("#fafafa")}
      <rect x="40" y="70" width="220" height="250" rx="24" fill="#4c1d95"/>
      <circle cx="150" cy="195" r="48" fill="#7c3aed"/>
      <text x="300" y="120" fill="#fafafa" font-size="26" font-family="system-ui,sans-serif" font-weight="800">${title}</text>
      <text x="300" y="152" fill="#a1a1aa" font-size="15" font-family="system-ui,sans-serif">${artist}</text>
      <rect x="300" y="190" width="480" height="6" rx="3" fill="#27272a"/>
      <rect x="300" y="190" width="280" height="6" rx="3" fill="#a78bfa"/>
      <circle cx="540" cy="280" r="32" fill="#fafafa"/>
      <polygon points="533,265 533,295 558,280" fill="#09090b"/>
    `),
  }
}

function landscapeSearch(id: string, query: string, accent: string): SampleScreen {
  return {
    id,
    dataUrl: landscapeSvg(`
      <rect width="${LW}" height="${LH}" fill="#09090b"/>
      ${landStatus("#fafafa")}
      <text x="32" y="72" fill="#fafafa" font-size="24" font-family="Georgia,serif" font-weight="700">Discover</text>
      <rect x="32" y="96" width="780" height="48" rx="14" fill="#18181b" stroke="${accent}" stroke-width="1.5"/>
      <text x="52" y="126" fill="${accent}" font-size="15" font-family="system-ui,sans-serif">${query}</text>
      ${card(32, 170, 240, 160, "#18181b", 16)}
      <text x="52" y="210" fill="#fafafa" font-size="16" font-family="system-ui,sans-serif" font-weight="700">Quick overview</text>
      <text x="52" y="236" fill="#71717a" font-size="12" font-family="system-ui,sans-serif">Trusted · 2m read</text>
      ${card(292, 170, 240, 160, "#18181b", 16)}
      <text x="312" y="210" fill="#fafafa" font-size="16" font-family="system-ui,sans-serif" font-weight="700">Key stages</text>
      <text x="312" y="236" fill="#71717a" font-size="12" font-family="system-ui,sans-serif">Cited sources</text>
      ${card(552, 170, 260, 160, "#18181b", 16)}
      <text x="572" y="210" fill="#fafafa" font-size="16" font-family="system-ui,sans-serif" font-weight="700">Try a quiz</text>
      <text x="572" y="236" fill="#71717a" font-size="12" font-family="system-ui,sans-serif">Expert Q&A</text>
    `),
  }
}

function landscapeCurated(id: string, title: string, accent: string): SampleScreen {
  return {
    id,
    dataUrl: landscapeSvg(`
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#db2777"/>
          <stop offset="100%" stop-color="#7c3aed"/>
        </linearGradient>
      </defs>
      <rect width="${LW}" height="${LH}" fill="url(#g)"/>
      ${landStatus("#ffffff")}
      <text x="36" y="80" fill="#ffffff" font-size="13" font-family="system-ui,sans-serif" letter-spacing="1.5">FOR YOU</text>
      <text x="36" y="120" fill="#ffffff" font-size="32" font-family="system-ui,sans-serif" font-weight="800">${title}</text>
      ${card(36, 160, 360, 180, "rgba(255,255,255,0.18)", 24)}
      <rect x="56" y="180" width="140" height="140" rx="18" fill="#ffffff" opacity="0.35"/>
      <rect x="216" y="180" width="150" height="64" rx="16" fill="#ffffff" opacity="0.28"/>
      <rect x="216" y="256" width="150" height="64" rx="16" fill="${accent}" opacity="0.55"/>
      <rect x="420" y="160" width="120" height="40" rx="20" fill="#ffffff" opacity="0.22"/>
      <text x="480" y="186" text-anchor="middle" fill="#ffffff" font-size="13" font-family="system-ui,sans-serif" font-weight="600">Stylish</text>
      <rect x="556" y="160" width="120" height="40" rx="20" fill="#ffffff" opacity="0.22"/>
      <text x="616" y="186" text-anchor="middle" fill="#ffffff" font-size="13" font-family="system-ui,sans-serif" font-weight="600">Luxury</text>
      <rect x="692" y="160" width="120" height="40" rx="20" fill="#ffffff" opacity="0.22"/>
      <text x="752" y="186" text-anchor="middle" fill="#ffffff" font-size="13" font-family="system-ui,sans-serif" font-weight="600">Unique</text>
    `),
  }
}

function builtInLandscapeScreens(): SampleScreen[] {
  return [
    landscapeBeauty("sample-land-beauty-1", "Essentials", "#a78bfa"),
    landscapeBeauty("sample-land-beauty-2", "New brands", "#f472b6"),
    landscapeBeauty("sample-land-beauty-3", "Simplified", "#c084fc"),
    landscapeBeauty("sample-land-beauty-4", "More beauty", "#818cf8"),
    landscapeBeauty("sample-land-beauty-5", "Skincare", "#e879f9"),
    landscapeListen("sample-land-listen-1", "Morning Brief", "Castique Daily"),
    landscapeListen("sample-land-listen-2", "Offline Mode", "Saved episodes"),
    landscapeListen("sample-land-listen-3", "Story Hour", "Keep listening"),
    landscapeListen("sample-land-listen-4", "Deep Focus", "Instrumental"),
    landscapeListen("sample-land-listen-5", "Late Night", "Guest series"),
    landscapeSearch("sample-land-search-1", "What is photosynthesis?", "#a3e635"),
    landscapeSearch("sample-land-search-2", "Search topics", "#bef264"),
    landscapeSearch("sample-land-search-3", "Discover feeds", "#a3e635"),
    landscapeSearch("sample-land-search-4", "Get answers", "#d9f99d"),
    landscapeSearch("sample-land-search-5", "Trusted picks", "#a3e635"),
    landscapeCurated("sample-land-curated-1", "Beauty curated", "#f9a8d4"),
    landscapeCurated("sample-land-curated-2", "Daily picks", "#f472b6"),
    landscapeCurated("sample-land-curated-3", "Personalized", "#e879f9"),
    landscapeCurated("sample-land-curated-4", "Made simple", "#c084fc"),
    landscapeCurated("sample-land-curated-5", "Your shelf", "#f9a8d4"),
  ]
}
