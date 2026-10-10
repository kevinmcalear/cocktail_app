// Draws the Tonight tab's calendar page, one PNG per day of the month, for
// Android and iOS before 26 (components/nav/tabCalendar.ts). White on clear at
// 96 px (24 dp at @4x), so the tab bar tints it. The same drawing as the web's
// CalendarDayIcon and the whole-app canvas's tab glyph (nav-phone-venue).
// Run from the repo root on a Mac: swift scripts/tab-calendar-icons.swift
import AppKit
import CoreText

let font = URL(fileURLWithPath: "node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf")
CTFontManagerRegisterFontsForURL(font as CFURL, .process, nil)
let out = "assets/images/tab-calendar"
let scale = 4
let px = 24 * scale
let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)

for day in 1...31 {
  let ctx = CGContext(data: nil, width: px, height: px, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  // The SVG's 24-unit box, y down.
  ctx.translateBy(x: 0, y: CGFloat(px))
  ctx.scaleBy(x: CGFloat(scale), y: -CGFloat(scale))
  ctx.setStrokeColor(white)
  ctx.setLineWidth(2)
  ctx.setLineCap(.round)
  ctx.setLineJoin(.round)
  ctx.addPath(CGPath(roundedRect: CGRect(x: 4, y: 5, width: 16, height: 15), cornerWidth: 2.5, cornerHeight: 2.5, transform: nil))
  ctx.move(to: CGPoint(x: 4, y: 10)); ctx.addLine(to: CGPoint(x: 20, y: 10))
  ctx.move(to: CGPoint(x: 8.5, y: 3)); ctx.addLine(to: CGPoint(x: 8.5, y: 7))
  ctx.move(to: CGPoint(x: 15.5, y: 3)); ctx.addLine(to: CGPoint(x: 15.5, y: 7))
  ctx.strokePath()

  // The day in Geist SemiBold, centred, baseline at 18.
  let attrs: [NSAttributedString.Key: Any] = [.font: CTFontCreateWithName("Geist-SemiBold" as CFString, 8, nil), .foregroundColor: NSColor.white]
  let line = CTLineCreateWithAttributedString(NSAttributedString(string: String(day), attributes: attrs))
  let width = CTLineGetTypographicBounds(line, nil, nil, nil)
  ctx.translateBy(x: 12 - CGFloat(width) / 2, y: 18)
  ctx.scaleBy(x: 1, y: -1)
  ctx.textPosition = .zero
  CTLineDraw(line, ctx)

  let png = NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .png, properties: [:])!
  try! png.write(to: URL(fileURLWithPath: "\(out)/\(day)@\(scale)x.png"))
}
print("Drew 31 days into \(out)")
