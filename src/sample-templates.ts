import {
  applyTemplate,
  createFrame,
  createSlide,
  createText,
  normalizeProject,
} from "./constants"
import type { Project, Slide, TemplateId, TextAlign } from "./types"

function projectFromSlides(
  name: string,
  slides: Slide[],
  targetId: Project["targetId"] = "iphone-69",
): Project {
  const activeSlideId = slides[0]!.id
  return normalizeProject({
    name,
    targetId,
    designTargetId: targetId,
    sizeEditMode: "current",
    thumbnailLayout: "landscape",
    activeSlideId,
    slides,
    sizeLayouts: {
      [targetId]: {
        slides: structuredClone(slides),
        activeSlideId,
      },
    },
  })
}

function slideWithShot(opts: {
  headline: string
  subline?: string
  screenshotId: string
  templateId: TemplateId
  colors?: string[]
  font?: string
  size?: number
  color?: string
  align?: TextAlign
  frame?: Partial<Parameters<typeof createFrame>[0]>
}): Slide {
  const base = applyTemplate(
    createSlide({
      headline: opts.headline,
      subline: opts.subline ?? "",
      textStyle: {
        font: opts.font,
        size: opts.size,
        color: opts.color,
        align: opts.align,
      },
    }),
    opts.templateId,
  )
  const frame = createFrame({
    ...base.frames[0],
    screenshotId: opts.screenshotId,
    ...opts.frame,
  })
  const texts = base.texts.map((text, index) =>
    createText({
      ...text,
      content:
        index === 0
          ? opts.headline
          : index === 1
            ? (opts.subline ?? text.content)
            : text.content,
      font: opts.font ?? text.font,
      color: opts.color ?? text.color,
      size: index === 0 ? (opts.size ?? text.size) : text.size,
      align: opts.align ?? text.align,
    }),
  )
  return {
    ...base,
    frames: [frame],
    texts,
    background: {
      ...base.background,
      colors: opts.colors ?? base.background.colors,
    },
    layerOrder: [frame.id, ...texts.map((t) => t.id)],
    selectedId: frame.id,
  }
}

/** Soft lavender beauty set — 5 slides with sample product UIs. */
export function buildBeautyEssentialsTemplate(): Project {
  const slides = [
    slideWithShot({
      headline: "Try top-rated beauty essentials",
      subline: "As seen in GQ · Forbes · ELLE",
      screenshotId: "sample-beauty-1",
      templateId: "tilted",
      colors: ["#ddd6fe", "#f5d0fe"],
      font: "Poppins",
      size: 64,
      color: "#1e1b4b",
      frame: { rotation: -8, y: 58, scale: 0.78 },
    }),
    slideWithShot({
      headline: "New brands, real reviews",
      subline: "Shopper-loved picks updated weekly",
      screenshotId: "sample-beauty-2",
      templateId: "device-bottom",
      colors: ["#ede9fe", "#fae8ff"],
      font: "Poppins",
      size: 62,
      color: "#1e1b4b",
    }),
    slideWithShot({
      headline: "Beauty simplified",
      subline: "A calm 3-step routine",
      screenshotId: "sample-beauty-3",
      templateId: "offset-left",
      colors: ["#e9d5ff", "#fbcfe8"],
      font: "Poppins",
      size: 68,
      color: "#1e1b4b",
    }),
    slideWithShot({
      headline: "More beauty, less noise",
      subline: "Curated shelves that stay on brand",
      screenshotId: "sample-beauty-4",
      templateId: "device-bottom",
      colors: ["#ddd6fe", "#fce7f3"],
      font: "Poppins",
      size: 60,
      color: "#1e1b4b",
    }),
    slideWithShot({
      headline: "Level up skincare",
      subline: "Tonight’s glow-up checklist",
      screenshotId: "sample-beauty-5",
      templateId: "close-up",
      colors: ["#c4b5fd", "#f9a8d4"],
      font: "Poppins",
      size: 66,
      color: "#1e1b4b",
    }),
  ]
  return projectFromSlides("Beauty Essentials", slides)
}

/** High-contrast dark podcast / audio set. */
export function buildListenEverywhereTemplate(): Project {
  const slides = [
    slideWithShot({
      headline: "LISTEN EVERYWHERE",
      subline: "Your shows, any screen",
      screenshotId: "sample-listen-1",
      templateId: "centered",
      colors: ["#09090b", "#18181b"],
      font: "Montserrat",
      size: 58,
      color: "#fafafa",
      frame: { y: 62, scale: 0.82, rotation: 0 },
    }),
    slideWithShot({
      headline: "LISTEN WITHOUT INTERNET",
      subline: "Download and go",
      screenshotId: "sample-listen-2",
      templateId: "centered",
      colors: ["#09090b", "#09090b"],
      font: "Montserrat",
      size: 54,
      color: "#fafafa",
    }),
    slideWithShot({
      headline: "STORIES THAT KEEP ENGAGING",
      subline: "Queue the next episode",
      screenshotId: "sample-listen-3",
      templateId: "device-bottom",
      colors: ["#0c0a09", "#1c1917"],
      font: "Montserrat",
      size: 52,
      color: "#fafafa",
    }),
    slideWithShot({
      headline: "FOCUS MODE",
      subline: "Soundscapes for deep work",
      screenshotId: "sample-listen-4",
      templateId: "centered",
      colors: ["#09090b", "#171717"],
      font: "Montserrat",
      size: 64,
      color: "#fafafa",
    }),
    slideWithShot({
      headline: "LATE NIGHT SERIES",
      subline: "Guest hosts every week",
      screenshotId: "sample-listen-5",
      templateId: "floating",
      colors: ["#09090b", "#27272a"],
      font: "Montserrat",
      size: 56,
      color: "#fafafa",
    }),
  ]
  return projectFromSlides("Listen Everywhere", slides)
}

/** Dark + lime discovery / search set. */
export function buildDiscoverFasterTemplate(): Project {
  const slides = [
    slideWithShot({
      headline: "Discover topics faster",
      subline: "Answers with sources you can trust",
      screenshotId: "sample-search-1",
      templateId: "neon-lime",
      colors: ["#09090b", "#14532d"],
      font: "Playfair Display",
      size: 64,
      color: "#a3e635",
      align: "left",
      frame: { y: 60, scale: 0.8 },
    }),
    slideWithShot({
      headline: "Search",
      subline: "Ask anything in plain language",
      screenshotId: "sample-search-2",
      templateId: "neon-lime",
      colors: ["#09090b", "#09090b"],
      font: "Playfair Display",
      size: 78,
      color: "#bef264",
      align: "left",
    }),
    slideWithShot({
      headline: "Discover",
      subline: "Feeds that stay sharp",
      screenshotId: "sample-search-3",
      templateId: "midnight-teal",
      colors: ["#09090b", "#052e16"],
      font: "Playfair Display",
      size: 78,
      color: "#a3e635",
      align: "left",
    }),
    slideWithShot({
      headline: "Answers",
      subline: "Cited, concise, follow-up ready",
      screenshotId: "sample-search-4",
      templateId: "neon-lime",
      colors: ["#09090b", "#14532d"],
      font: "Playfair Display",
      size: 78,
      color: "#d9f99d",
      align: "left",
    }),
    slideWithShot({
      headline: "Trusted",
      subline: "Expert-backed picks",
      screenshotId: "sample-search-5",
      templateId: "offset-right",
      colors: ["#09090b", "#022c22"],
      font: "Playfair Display",
      size: 78,
      color: "#a3e635",
      align: "left",
    }),
  ]
  return projectFromSlides("Discover Faster", slides)
}

/** Vibrant pink/purple curated beauty set. */
export function buildBeautyCuratedTemplate(): Project {
  const slides = [
    slideWithShot({
      headline: "Beauty curated",
      subline: "Personal picks, zero clutter",
      screenshotId: "sample-curated-1",
      templateId: "coral-punch",
      colors: ["#db2777", "#7c3aed"],
      font: "Poppins",
      size: 72,
      color: "#ffffff",
      frame: { y: 64, scale: 0.84 },
    }),
    slideWithShot({
      headline: "Daily picks",
      subline: "Fresh looks every morning",
      screenshotId: "sample-curated-2",
      templateId: "tilted",
      colors: ["#ec4899", "#8b5cf6"],
      font: "Poppins",
      size: 68,
      color: "#ffffff",
      frame: { rotation: 10, y: 58, scale: 0.76 },
    }),
    slideWithShot({
      headline: "Personalized beauty picks",
      subline: "Stylish · Luxury · Unique",
      screenshotId: "sample-curated-3",
      templateId: "hero-peek",
      colors: ["#d946ef", "#6366f1"],
      font: "Poppins",
      size: 58,
      color: "#ffffff",
    }),
    slideWithShot({
      headline: "Customized beauty made simple",
      subline: "Build a shelf in minutes",
      screenshotId: "sample-curated-4",
      templateId: "device-bottom",
      colors: ["#db2777", "#6d28d9"],
      font: "Poppins",
      size: 56,
      color: "#ffffff",
    }),
    slideWithShot({
      headline: "Your shelf",
      subline: "Favorites that travel with you",
      screenshotId: "sample-curated-5",
      templateId: "floating",
      colors: ["#f472b6", "#7c3aed"],
      font: "Poppins",
      size: 70,
      color: "#ffffff",
    }),
  ]
  return projectFromSlides("Beauty Curated", slides)
}

const LAND_DEVICE = "iphone-69-land" as const
const LAND_TARGET = "iphone-69-landscape" as const

function landFrame(
  extras: Partial<Parameters<typeof createFrame>[0]> = {},
): Partial<Parameters<typeof createFrame>[0]> {
  return {
    deviceId: LAND_DEVICE,
    y: 55,
    scale: 0.88,
    rotation: 0,
    ...extras,
  }
}

/** Landscape counterparts of the portrait gallery templates (5 slides each). */
export function buildLandBeautyEssentialsTemplate(): Project {
  const slides = [
    slideWithShot({
      headline: "Try top-rated beauty essentials",
      subline: "As seen in GQ · Forbes · ELLE",
      screenshotId: "sample-land-beauty-1",
      templateId: "tilted",
      colors: ["#ddd6fe", "#f5d0fe"],
      font: "Poppins",
      size: 58,
      color: "#1e1b4b",
      frame: landFrame({ rotation: -6, scale: 0.85 }),
    }),
    slideWithShot({
      headline: "New brands, real reviews",
      subline: "Shopper-loved picks updated weekly",
      screenshotId: "sample-land-beauty-2",
      templateId: "device-bottom",
      colors: ["#ede9fe", "#fae8ff"],
      font: "Poppins",
      size: 56,
      color: "#1e1b4b",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "Beauty simplified",
      subline: "A calm 3-step routine",
      screenshotId: "sample-land-beauty-3",
      templateId: "offset-left",
      colors: ["#e9d5ff", "#fbcfe8"],
      font: "Poppins",
      size: 60,
      color: "#1e1b4b",
      frame: landFrame({ scale: 0.86 }),
    }),
    slideWithShot({
      headline: "More beauty, less noise",
      subline: "Curated shelves that stay on brand",
      screenshotId: "sample-land-beauty-4",
      templateId: "device-bottom",
      colors: ["#ddd6fe", "#fce7f3"],
      font: "Poppins",
      size: 54,
      color: "#1e1b4b",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "Level up skincare",
      subline: "Tonight’s glow-up checklist",
      screenshotId: "sample-land-beauty-5",
      templateId: "close-up",
      colors: ["#c4b5fd", "#f9a8d4"],
      font: "Poppins",
      size: 58,
      color: "#1e1b4b",
      frame: landFrame({ scale: 0.92 }),
    }),
  ]
  return projectFromSlides("Beauty Essentials · Landscape", slides, LAND_TARGET)
}

export function buildLandListenEverywhereTemplate(): Project {
  const slides = [
    slideWithShot({
      headline: "LISTEN EVERYWHERE",
      subline: "Your shows, any screen",
      screenshotId: "sample-land-listen-1",
      templateId: "centered",
      colors: ["#09090b", "#18181b"],
      font: "Montserrat",
      size: 52,
      color: "#fafafa",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "LISTEN WITHOUT INTERNET",
      subline: "Download and go",
      screenshotId: "sample-land-listen-2",
      templateId: "centered",
      colors: ["#09090b", "#09090b"],
      font: "Montserrat",
      size: 48,
      color: "#fafafa",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "STORIES THAT KEEP ENGAGING",
      subline: "Queue the next episode",
      screenshotId: "sample-land-listen-3",
      templateId: "device-bottom",
      colors: ["#0c0a09", "#1c1917"],
      font: "Montserrat",
      size: 46,
      color: "#fafafa",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "FOCUS MODE",
      subline: "Soundscapes for deep work",
      screenshotId: "sample-land-listen-4",
      templateId: "centered",
      colors: ["#09090b", "#171717"],
      font: "Montserrat",
      size: 58,
      color: "#fafafa",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "LATE NIGHT SERIES",
      subline: "Guest hosts every week",
      screenshotId: "sample-land-listen-5",
      templateId: "floating",
      colors: ["#09090b", "#27272a"],
      font: "Montserrat",
      size: 50,
      color: "#fafafa",
      frame: landFrame({ scale: 0.86 }),
    }),
  ]
  return projectFromSlides("Listen Everywhere · Landscape", slides, LAND_TARGET)
}

export function buildLandDiscoverFasterTemplate(): Project {
  const slides = [
    slideWithShot({
      headline: "Discover topics faster",
      subline: "Answers with sources you can trust",
      screenshotId: "sample-land-search-1",
      templateId: "neon-lime",
      colors: ["#09090b", "#14532d"],
      font: "Playfair Display",
      size: 56,
      color: "#a3e635",
      align: "left",
      frame: landFrame({ scale: 0.86 }),
    }),
    slideWithShot({
      headline: "Search",
      subline: "Ask anything in plain language",
      screenshotId: "sample-land-search-2",
      templateId: "neon-lime",
      colors: ["#09090b", "#09090b"],
      font: "Playfair Display",
      size: 70,
      color: "#bef264",
      align: "left",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "Discover",
      subline: "Feeds that stay sharp",
      screenshotId: "sample-land-search-3",
      templateId: "midnight-teal",
      colors: ["#09090b", "#052e16"],
      font: "Playfair Display",
      size: 70,
      color: "#a3e635",
      align: "left",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "Answers",
      subline: "Cited, concise, follow-up ready",
      screenshotId: "sample-land-search-4",
      templateId: "neon-lime",
      colors: ["#09090b", "#14532d"],
      font: "Playfair Display",
      size: 70,
      color: "#d9f99d",
      align: "left",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "Trusted",
      subline: "Expert-backed picks",
      screenshotId: "sample-land-search-5",
      templateId: "offset-right",
      colors: ["#09090b", "#022c22"],
      font: "Playfair Display",
      size: 70,
      color: "#a3e635",
      align: "left",
      frame: landFrame({ scale: 0.86 }),
    }),
  ]
  return projectFromSlides("Discover Faster · Landscape", slides, LAND_TARGET)
}

export function buildLandBeautyCuratedTemplate(): Project {
  const slides = [
    slideWithShot({
      headline: "Beauty curated",
      subline: "Personal picks, zero clutter",
      screenshotId: "sample-land-curated-1",
      templateId: "coral-punch",
      colors: ["#db2777", "#7c3aed"],
      font: "Poppins",
      size: 64,
      color: "#ffffff",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "Daily picks",
      subline: "Fresh looks every morning",
      screenshotId: "sample-land-curated-2",
      templateId: "tilted",
      colors: ["#ec4899", "#8b5cf6"],
      font: "Poppins",
      size: 60,
      color: "#ffffff",
      frame: landFrame({ rotation: 8, scale: 0.85 }),
    }),
    slideWithShot({
      headline: "Personalized beauty picks",
      subline: "Stylish · Luxury · Unique",
      screenshotId: "sample-land-curated-3",
      templateId: "hero-peek",
      colors: ["#d946ef", "#6366f1"],
      font: "Poppins",
      size: 52,
      color: "#ffffff",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "Customized beauty made simple",
      subline: "Build a shelf in minutes",
      screenshotId: "sample-land-curated-4",
      templateId: "device-bottom",
      colors: ["#db2777", "#6d28d9"],
      font: "Poppins",
      size: 50,
      color: "#ffffff",
      frame: landFrame(),
    }),
    slideWithShot({
      headline: "Your shelf",
      subline: "Favorites that travel with you",
      screenshotId: "sample-land-curated-5",
      templateId: "floating",
      colors: ["#f472b6", "#7c3aed"],
      font: "Poppins",
      size: 62,
      color: "#ffffff",
      frame: landFrame({ scale: 0.86 }),
    }),
  ]
  return projectFromSlides("Beauty Curated · Landscape", slides, LAND_TARGET)
}

export type SeedTemplateSpec = {
  id: string
  slug: string
  title: string
  description: string
  sort_order: number
  build: () => Project
}

/** Fixed-id catalog templates with sample screenshots. */
export const SEED_TEMPLATE_SPECS: SeedTemplateSpec[] = [
  {
    id: "seed-tpl-beauty-essentials",
    slug: "beauty-essentials",
    title: "Beauty Essentials",
    description: "Soft purple beauty set with product UI samples",
    sort_order: 0,
    build: buildBeautyEssentialsTemplate,
  },
  {
    id: "seed-tpl-listen",
    slug: "listen-everywhere",
    title: "Listen Everywhere",
    description: "Bold dark podcast layouts with player UI",
    sort_order: 1,
    build: buildListenEverywhereTemplate,
  },
  {
    id: "seed-tpl-discover",
    slug: "discover-faster",
    title: "Discover Faster",
    description: "Lime-on-black search and answers set",
    sort_order: 2,
    build: buildDiscoverFasterTemplate,
  },
  {
    id: "seed-tpl-curated",
    slug: "beauty-curated",
    title: "Beauty Curated",
    description: "Pink–purple gradient beauty storytelling",
    sort_order: 3,
    build: buildBeautyCuratedTemplate,
  },
  {
    id: "seed-tpl-land-beauty",
    slug: "beauty-essentials-landscape",
    title: "Beauty Essentials",
    description: "Landscape beauty set with wide product UIs",
    sort_order: 4,
    build: buildLandBeautyEssentialsTemplate,
  },
  {
    id: "seed-tpl-land-listen",
    slug: "listen-everywhere-landscape",
    title: "Listen Everywhere",
    description: "Landscape podcast layouts with player UI",
    sort_order: 5,
    build: buildLandListenEverywhereTemplate,
  },
  {
    id: "seed-tpl-land-discover",
    slug: "discover-faster-landscape",
    title: "Discover Faster",
    description: "Landscape lime-on-black search set",
    sort_order: 6,
    build: buildLandDiscoverFasterTemplate,
  },
  {
    id: "seed-tpl-land-curated",
    slug: "beauty-curated-landscape",
    title: "Beauty Curated",
    description: "Landscape pink–purple beauty storytelling",
    sort_order: 7,
    build: buildLandBeautyCuratedTemplate,
  },
]

/** Bump when seed templates or sample screens change. */
export const CATALOG_SEED_VERSION = 10
