import { deviceSpec } from "./constants"
import type { ClipartLayer, Frame } from "./types"

export type DeviceBox = {
  centerX: number
  centerY: number
  deviceWidth: number
  deviceHeight: number
}

export function deviceBoxForFrame(
  frame: Frame,
  artboardWidth: number,
  artboardHeight: number,
): DeviceBox {
  const spec = deviceSpec(frame.deviceId)
  const deviceWidth = artboardWidth * frame.scale
  const deviceHeight = deviceWidth / spec.aspect
  return {
    centerX: (frame.x / 100) * artboardWidth,
    centerY: (frame.y / 100) * artboardHeight,
    deviceWidth,
    deviceHeight,
  }
}

/** Convert artboard-centered clipart pose into device-relative % offsets. */
export function artboardToAttached(
  clipart: Pick<ClipartLayer, "x" | "y" | "width" | "aspect">,
  frame: Frame,
  artboardWidth: number,
  artboardHeight: number,
): Pick<ClipartLayer, "x" | "y" | "width"> {
  const box = deviceBoxForFrame(frame, artboardWidth, artboardHeight)
  const cx = (clipart.x / 100) * artboardWidth
  const cy = (clipart.y / 100) * artboardHeight
  const clipartWidth = (clipart.width / 100) * artboardWidth
  return {
    x: ((cx - box.centerX) / box.deviceWidth) * 100,
    y: ((cy - box.centerY) / box.deviceHeight) * 100,
    width: (clipartWidth / box.deviceWidth) * 100,
  }
}

/** Convert device-relative clipart pose back to artboard %. */
export function attachedToArtboard(
  clipart: Pick<ClipartLayer, "x" | "y" | "width" | "aspect">,
  frame: Frame,
  artboardWidth: number,
  artboardHeight: number,
): Pick<ClipartLayer, "x" | "y" | "width"> {
  const box = deviceBoxForFrame(frame, artboardWidth, artboardHeight)
  const clipartWidth = (clipart.width / 100) * box.deviceWidth
  const cx = box.centerX + (clipart.x / 100) * box.deviceWidth
  const cy = box.centerY + (clipart.y / 100) * box.deviceHeight
  return {
    x: (cx / artboardWidth) * 100,
    y: (cy / artboardHeight) * 100,
    width: (clipartWidth / artboardWidth) * 100,
  }
}

export type GestureAttachPreset = "hold-left" | "hold-right" | "point" | "tap"

/** Sensible device-relative poses for common App Store hand comps. */
export function gestureAttachPreset(
  preset: GestureAttachPreset,
): Pick<ClipartLayer, "x" | "y" | "width" | "rotation"> {
  switch (preset) {
    case "hold-left":
      return { x: -55, y: 35, width: 95, rotation: -8 }
    case "hold-right":
      return { x: 55, y: 35, width: 95, rotation: 8 }
    case "point":
      return { x: 18, y: 22, width: 70, rotation: -12 }
    case "tap":
      return { x: 8, y: 28, width: 55, rotation: -6 }
  }
}
