import { deviceSpec } from "./constants"
import type { ClipartLayer, Frame, LensLayer, Slide, TextLayer } from "./types"

export type OverflowEdges = {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

function deviceMetrics(frame: Frame, width: number, height: number) {
  const spec = deviceSpec(frame.deviceId)
  const deviceWidth = width * frame.scale
  const deviceHeight = deviceWidth / spec.aspect
  const cx = (frame.x / 100) * width
  const cy = (frame.y / 100) * height
  return { deviceWidth, deviceHeight, cx, cy, spec }
}

function clipartMetrics(clipart: ClipartLayer, width: number, height: number) {
  const aspect =
    Number.isFinite(clipart.aspect) && clipart.aspect > 0 ? clipart.aspect : 1
  const clipartWidth = (clipart.width / 100) * width
  const clipartHeight = clipartWidth / aspect
  const cx = (clipart.x / 100) * width
  const cy = (clipart.y / 100) * height
  return { clipartWidth, clipartHeight, cx, cy, aspect }
}

function continuityOffset(
  ownerSlideIndex: number,
  guestSlideIndex: number,
  stridePercent = 100,
): number {
  return (ownerSlideIndex - guestSlideIndex) * stridePercent
}

function textMetrics(text: TextLayer, width: number, height: number) {
  const textWidth = (text.width / 100) * width
  const textHeight = Math.max(24, (text.size / 1000) * width * 2.2)
  const cx = (text.x / 100) * width
  const cy = (text.y / 100) * height
  return { textWidth, textHeight, cx, cy }
}

function lensMetrics(lens: LensLayer, width: number, height: number) {
  const lensWidth = (lens.width / 100) * width
  const lensHeight = (lens.height / 100) * height
  const cx = (lens.x / 100) * width
  const cy = (lens.y / 100) * height
  return { lensWidth, lensHeight, cx, cy }
}

export function deviceHorizontalHalfWidth(
  frame: Frame,
  width: number,
  height: number,
): number {
  const { deviceWidth, deviceHeight } = deviceMetrics(frame, width, height)
  const radZ = (frame.rotation * Math.PI) / 180
  const radX = (frame.rotationX * Math.PI) / 180
  const radY = (frame.rotationY * Math.PI) / 180
  const cosZ = Math.abs(Math.cos(radZ))
  const sinZ = Math.abs(Math.sin(radZ))
  const halfW2d = (deviceWidth * cosZ + deviceHeight * sinZ) / 2
  const tiltExpandX =
    Math.abs(Math.sin(radY)) * deviceHeight * 0.5 +
    Math.abs(Math.sin(radX)) * deviceWidth * 0.08
  return halfW2d + tiltExpandX
}

export function clipartHorizontalHalfWidth(
  clipart: ClipartLayer,
  width: number,
  height: number,
): number {
  const { clipartWidth, clipartHeight } = clipartMetrics(clipart, width, height)
  const rad = (clipart.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return (clipartWidth * cos + clipartHeight * sin) / 2
}

function continuityIndicesFromBounds(
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  cx: number,
  halfW: number,
): number[] {
  const globalLeft = ownerSlideIndex * width + cx - halfW
  const globalRight = ownerSlideIndex * width + cx + halfW
  const indices: number[] = []
  for (let i = 0; i < slideCount; i++) {
    const slideLeft = i * width
    const slideRight = (i + 1) * width
    if (globalRight > slideLeft + 0.5 && globalLeft < slideRight - 0.5) {
      indices.push(i)
    }
  }
  return indices
}

function continuityPaddingFromBounds(
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  cx: number,
  halfW: number,
): { prepend: number; append: number } {
  const globalLeft = ownerSlideIndex * width + cx - halfW
  const globalRight = ownerSlideIndex * width + cx + halfW
  const prepend =
    globalLeft < 0 ? Math.max(0, Math.ceil(-globalLeft / width)) : 0
  const append =
    globalRight > slideCount * width
      ? Math.max(0, Math.ceil((globalRight - slideCount * width) / width))
      : 0
  return { prepend, append }
}

/** Slide indices whose horizontal bounds intersect a continued device. */
export function continuityClipIndices(
  frame: Frame,
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  height: number,
): number[] {
  const { cx } = deviceMetrics(frame, width, height)
  const halfW = deviceHorizontalHalfWidth(frame, width, height)
  return continuityIndicesFromBounds(ownerSlideIndex, slideCount, width, cx, halfW)
}

export function clipartContinuityClipIndices(
  clipart: ClipartLayer,
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  height: number,
): number[] {
  const { cx } = clipartMetrics(clipart, width, height)
  const halfW = clipartHorizontalHalfWidth(clipart, width, height)
  return continuityIndicesFromBounds(ownerSlideIndex, slideCount, width, cx, halfW)
}

export function frameOverflow(
  frame: Frame,
  width: number,
  height: number,
): OverflowEdges {
  const { deviceWidth, deviceHeight, cx, cy } = deviceMetrics(frame, width, height)
  const halfW = deviceHorizontalHalfWidth(frame, width, height)
  const radZ = (frame.rotation * Math.PI) / 180
  const radX = (frame.rotationX * Math.PI) / 180
  const radY = (frame.rotationY * Math.PI) / 180
  const cosZ = Math.abs(Math.cos(radZ))
  const sinZ = Math.abs(Math.sin(radZ))
  const halfH2d = (deviceWidth * sinZ + deviceHeight * cosZ) / 2
  const tiltExpandY =
    Math.abs(Math.sin(radX)) * deviceHeight * 0.5 +
    Math.abs(Math.sin(radY)) * deviceWidth * 0.08
  const halfH = halfH2d + tiltExpandY
  return {
    left: cx - halfW < -1,
    right: cx + halfW > width + 1,
    top: cy - halfH < -1,
    bottom: cy + halfH > height + 1,
  }
}

export function clipartOverflow(
  clipart: ClipartLayer,
  width: number,
  height: number,
): OverflowEdges {
  const { clipartWidth, clipartHeight, cx, cy } = clipartMetrics(
    clipart,
    width,
    height,
  )
  const halfW = clipartHorizontalHalfWidth(clipart, width, height)
  const rad = (clipart.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const halfH = (clipartWidth * sin + clipartHeight * cos) / 2
  return {
    left: cx - halfW < -1,
    right: cx + halfW > width + 1,
    top: cy - halfH < -1,
    bottom: cy + halfH > height + 1,
  }
}

export function textOverflow(
  text: TextLayer,
  width: number,
  height: number,
): OverflowEdges {
  const { textWidth, textHeight, cx, cy } = textMetrics(text, width, height)
  const rad = ((text.rotation ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const halfW = (textWidth * cos + textHeight * sin) / 2
  const halfH = (textWidth * sin + textHeight * cos) / 2
  return {
    left: cx - halfW < -1,
    right: cx + halfW > width + 1,
    top: cy - halfH < -1,
    bottom: cy + halfH > height + 1,
  }
}

export function lensOverflow(
  lens: LensLayer,
  width: number,
  height: number,
): OverflowEdges {
  const { lensWidth, lensHeight, cx, cy } = lensMetrics(lens, width, height)
  const rad = ((lens.rotation ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const halfW = (lensWidth * cos + lensHeight * sin) / 2
  const halfH = (lensWidth * sin + lensHeight * cos) / 2
  return {
    left: cx - halfW < -1,
    right: cx + halfW > width + 1,
    top: cy - halfH < -1,
    bottom: cy + halfH > height + 1,
  }
}

export function overflowsHorizontally(edges: OverflowEdges): boolean {
  return edges.left || edges.right
}

export type GuestFrame = {
  frame: Frame
  originSlideId: string
  isGuest: boolean
}

export type GuestClipart = {
  clipart: ClipartLayer
  originSlideId: string
  isGuest: boolean
}

export type GuestText = {
  text: TextLayer
  originSlideId: string
  isGuest: boolean
}

export type GuestLens = {
  lens: LensLayer
  source: LensLayer
  originSlideId: string
  isGuest: boolean
}

/** Shift a frame so its center aligns on another slide (offset = owner − guest). */
export function continuedFrameForSlide(
  frame: Frame,
  ownerSlideIndex: number,
  guestSlideIndex: number,
  stridePercent = 100,
): Frame {
  return {
    ...frame,
    x: frame.x + continuityOffset(ownerSlideIndex, guestSlideIndex, stridePercent),
  }
}

export function continuedClipartForSlide(
  clipart: ClipartLayer,
  ownerSlideIndex: number,
  guestSlideIndex: number,
  stridePercent = 100,
): ClipartLayer {
  return {
    ...clipart,
    x:
      clipart.x +
      continuityOffset(ownerSlideIndex, guestSlideIndex, stridePercent),
  }
}

export function continuedTextForSlide(
  text: TextLayer,
  ownerSlideIndex: number,
  guestSlideIndex: number,
  stridePercent = 100,
): TextLayer {
  return {
    ...text,
    x: text.x + continuityOffset(ownerSlideIndex, guestSlideIndex, stridePercent),
  }
}

export function continuedLensForSlide(
  lens: LensLayer,
  ownerSlideIndex: number,
  guestSlideIndex: number,
  stridePercent = 100,
): LensLayer {
  const dx = continuityOffset(ownerSlideIndex, guestSlideIndex, stridePercent)
  return {
    ...lens,
    x: lens.x + dx,
    lockedX: lens.lockedX + dx,
  }
}

export function guestFramesForSlide(
  slides: Slide[],
  index: number,
  width: number,
  height: number,
  stridePercent = 100,
): GuestFrame[] {
  const guests: GuestFrame[] = []
  const localFrameIds = new Set(slides[index]?.frames.map((frame) => frame.id) ?? [])

  slides.forEach((ownerSlide, ownerIndex) => {
    for (const frame of ownerSlide.frames) {
      if (frame.overflow !== "continue") continue
      if (ownerIndex === index) continue
      if (localFrameIds.has(frame.id)) continue
      const clips = continuityClipIndices(
        frame,
        ownerIndex,
        slides.length,
        width,
        height,
      )
      if (!clips.includes(index)) continue
      guests.push({
        frame: continuedFrameForSlide(
          frame,
          ownerIndex,
          index,
          stridePercent,
        ),
        originSlideId: ownerSlide.id,
        isGuest: true,
      })
    }
  })

  return guests
}

export function guestClipartsForSlide(
  slides: Slide[],
  index: number,
  width: number,
  height: number,
  stridePercent = 100,
): GuestClipart[] {
  const guests: GuestClipart[] = []
  const localIds = new Set(
    slides[index]?.cliparts.map((clipart) => clipart.id) ?? [],
  )

  slides.forEach((ownerSlide, ownerIndex) => {
    for (const clipart of ownerSlide.cliparts) {
      if (clipart.overflow !== "continue") continue
      if (ownerIndex === index) continue
      if (localIds.has(clipart.id)) continue
      const clips = clipartContinuityClipIndices(
        clipart,
        ownerIndex,
        slides.length,
        width,
        height,
      )
      if (!clips.includes(index)) continue
      guests.push({
        clipart: continuedClipartForSlide(
          clipart,
          ownerIndex,
          index,
          stridePercent,
        ),
        originSlideId: ownerSlide.id,
        isGuest: true,
      })
    }
  })

  return guests
}

export function textContinuityClipIndices(
  text: TextLayer,
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  height: number,
): number[] {
  const { cx, textWidth } = textMetrics(text, width, height)
  return continuityIndicesFromBounds(
    ownerSlideIndex,
    slideCount,
    width,
    cx,
    textWidth / 2,
  )
}

export function lensContinuityClipIndices(
  lens: LensLayer,
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  height: number,
): number[] {
  const { cx, lensWidth } = lensMetrics(lens, width, height)
  return continuityIndicesFromBounds(
    ownerSlideIndex,
    slideCount,
    width,
    cx,
    lensWidth / 2,
  )
}

export function guestTextsForSlide(
  slides: Slide[],
  index: number,
  width: number,
  height: number,
  stridePercent = 100,
): GuestText[] {
  const guests: GuestText[] = []
  const localIds = new Set(slides[index]?.texts.map((text) => text.id) ?? [])

  slides.forEach((ownerSlide, ownerIndex) => {
    for (const text of ownerSlide.texts) {
      if (text.overflow !== "continue") continue
      if (ownerIndex === index) continue
      if (localIds.has(text.id)) continue
      const clips = textContinuityClipIndices(
        text,
        ownerIndex,
        slides.length,
        width,
        height,
      )
      if (!clips.includes(index)) continue
      guests.push({
        text: continuedTextForSlide(text, ownerIndex, index, stridePercent),
        originSlideId: ownerSlide.id,
        isGuest: true,
      })
    }
  })

  return guests
}

export function guestLensesForSlide(
  slides: Slide[],
  index: number,
  width: number,
  height: number,
  stridePercent = 100,
): GuestLens[] {
  const guests: GuestLens[] = []
  const localIds = new Set(
    (slides[index]?.lenses ?? []).map((lens) => lens.id),
  )

  slides.forEach((ownerSlide, ownerIndex) => {
    for (const lens of ownerSlide.lenses ?? []) {
      if (lens.overflow !== "continue") continue
      if (ownerIndex === index) continue
      if (localIds.has(lens.id)) continue
      const clips = lensContinuityClipIndices(
        lens,
        ownerIndex,
        slides.length,
        width,
        height,
      )
      if (!clips.includes(index)) continue
      guests.push({
        lens: continuedLensForSlide(lens, ownerIndex, index, stridePercent),
        source: lens,
        originSlideId: ownerSlide.id,
        isGuest: true,
      })
    }
  })

  return guests
}

export function guestIdsForSlide(
  slides: Slide[],
  index: number,
  width: number,
  height: number,
  stridePercent = 100,
): string[] {
  return [
    ...guestFramesForSlide(slides, index, width, height, stridePercent).map(
      (guest) => guest.frame.id,
    ),
    ...guestClipartsForSlide(slides, index, width, height, stridePercent).map(
      (guest) => guest.clipart.id,
    ),
    ...guestTextsForSlide(slides, index, width, height, stridePercent).map(
      (guest) => guest.text.id,
    ),
    ...guestLensesForSlide(slides, index, width, height, stridePercent).map(
      (guest) => guest.lens.id,
    ),
  ]
}

export function findFrameOwner(
  slides: Slide[],
  frameId: string,
): Slide | undefined {
  return slides.find((slide) =>
    slide.frames.some((frame) => frame.id === frameId),
  )
}

export function findClipartOwner(
  slides: Slide[],
  clipartId: string,
): Slide | undefined {
  return slides.find((slide) =>
    slide.cliparts.some((clipart) => clipart.id === clipartId),
  )
}

export function findTextOwner(
  slides: Slide[],
  textId: string,
): Slide | undefined {
  return slides.find((slide) => slide.texts.some((text) => text.id === textId))
}

export function findLensOwner(
  slides: Slide[],
  lensId: string,
): Slide | undefined {
  return slides.find((slide) =>
    (slide.lenses ?? []).some((lens) => lens.id === lensId),
  )
}

export type ContinuityClipartItem = {
  clipart: ClipartLayer
  ownerSlideIndex: number
  ownerSlideId: string
  clipIndices: number[]
}

/** Cliparts with Continue that visually span more than one slide. */
export function continuityClipartItems(
  slides: Slide[],
  width: number,
  height: number,
): ContinuityClipartItem[] {
  const items: ContinuityClipartItem[] = []
  slides.forEach((slide, index) => {
    for (const clipart of slide.cliparts) {
      if (clipart.overflow !== "continue") continue
      const clipIndices = clipartContinuityClipIndices(
        clipart,
        index,
        slides.length,
        width,
        height,
      )
      if (clipIndices.length <= 1) continue
      items.push({
        clipart,
        ownerSlideIndex: index,
        ownerSlideId: slide.id,
        clipIndices,
      })
    }
  })
  return items
}

export function continuityClipartIds(
  items: ContinuityClipartItem[],
): Set<string> {
  return new Set(items.map((item) => item.clipart.id))
}

export type ContinuityItem = {
  frame: Frame
  ownerSlideIndex: number
  ownerSlideId: string
  clipIndices: number[]
}

/** Frames with Continue that visually span more than one slide. */
export function continuityItems(
  slides: Slide[],
  width: number,
  height: number,
): ContinuityItem[] {
  const items: ContinuityItem[] = []
  slides.forEach((slide, index) => {
    for (const frame of slide.frames) {
      if (frame.overflow !== "continue") continue
      const clipIndices = continuityClipIndices(
        frame,
        index,
        slides.length,
        width,
        height,
      )
      if (clipIndices.length <= 1) continue
      items.push({
        frame,
        ownerSlideIndex: index,
        ownerSlideId: slide.id,
        clipIndices,
      })
    }
  })
  return items
}

export function continuityFrameIds(items: ContinuityItem[]): Set<string> {
  return new Set(items.map((item) => item.frame.id))
}

export type ContinuitySpanGroup = {
  startIndex: number
  endIndex: number
  items: ContinuityItem[]
}

/** Export/preview group covering every slide touched by continued devices on `slideIndex`. */
export function continuitySpanForSlide(
  slides: Slide[],
  slideIndex: number,
  width: number,
  height: number,
): ContinuitySpanGroup | null {
  const items = continuityItems(slides, width, height)
  const affecting = items.filter((item) => item.clipIndices.includes(slideIndex))
  if (affecting.length === 0) return null

  let startIndex = slideIndex
  let endIndex = slideIndex
  for (const item of affecting) {
    startIndex = Math.min(startIndex, ...item.clipIndices)
    endIndex = Math.max(endIndex, ...item.clipIndices)
  }

  const spanItems = items.filter((item) =>
    item.clipIndices.some(
      (clipIndex) => clipIndex >= startIndex && clipIndex <= endIndex,
    ),
  )

  return { startIndex, endIndex, items: spanItems }
}

/** How many empty slides to prepend/append so a continued device fully fits. */
export function continuitySlidePadding(
  frame: Frame,
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  height: number,
): { prepend: number; append: number } {
  const { cx } = deviceMetrics(frame, width, height)
  const halfW = deviceHorizontalHalfWidth(frame, width, height)
  return continuityPaddingFromBounds(ownerSlideIndex, slideCount, width, cx, halfW)
}

export function clipartContinuitySlidePadding(
  clipart: ClipartLayer,
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  height: number,
): { prepend: number; append: number } {
  const { cx } = clipartMetrics(clipart, width, height)
  const halfW = clipartHorizontalHalfWidth(clipart, width, height)
  return continuityPaddingFromBounds(ownerSlideIndex, slideCount, width, cx, halfW)
}

export function textContinuitySlidePadding(
  text: TextLayer,
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  height: number,
): { prepend: number; append: number } {
  const { cx, textWidth } = textMetrics(text, width, height)
  return continuityPaddingFromBounds(
    ownerSlideIndex,
    slideCount,
    width,
    cx,
    textWidth / 2,
  )
}

export function lensContinuitySlidePadding(
  lens: LensLayer,
  ownerSlideIndex: number,
  slideCount: number,
  width: number,
  height: number,
): { prepend: number; append: number } {
  const { cx, lensWidth } = lensMetrics(lens, width, height)
  return continuityPaddingFromBounds(
    ownerSlideIndex,
    slideCount,
    width,
    cx,
    lensWidth / 2,
  )
}
