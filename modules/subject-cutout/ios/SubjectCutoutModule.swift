import CoreML
import ExpoModulesCore
import ImageIO
import UniformTypeIdentifiers
import Vision

/**
 Lifts the subject (the drink) out of a photo on the device with Vision's
 foreground instance mask (iOS 17+), and writes it as a PNG with alpha to the
 caches directory. Nothing leaves the phone.
 */
public class SubjectCutoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SubjectCutout")

    Function("isSupported") { () -> Bool in
      if #available(iOS 17.0, *) { return true }
      return false
    }

    // Runs off the main thread (AsyncFunction's default queue).
    AsyncFunction("cutout") { (uri: String) -> [String: Any] in
      guard #available(iOS 17.0, *) else { return ["reason": "unsupported"] }
      return try Cutout.run(uri: uri)
    }
  }
}

@available(iOS 17.0, *)
enum Cutout {
  /// Long side of the PNG. A phone's hero is about 1200 px wide at 3x; a
  /// full-size cut-out PNG (alpha keeps it from compressing like a JPEG) would be 10 MB.
  static let maxSide = 1440
  /// The drawn-drink paper (tokens `paper`, #EFE9DD), stored under fully clear
  /// pixels. Alpha hides it in the app, but the image-palette worker's JPEG
  /// thumbnail drops alpha, so clear areas come out as paper there instead of black.
  /// ponytail: flatten onto paper in supabase/functions/_shared/thumbnail.ts
  /// instead, once that is deployed (it's human-gated), and store plain clear pixels.
  static let paper: (UInt8, UInt8, UInt8) = (0xEF, 0xE9, 0xDD)

  static func run(uri: String) throws -> [String: Any] {
    let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
    guard let url, let image = load(url) else { return ["reason": "unreadable"] }

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    #if targetEnvironment(simulator)
    // Simulators have no Neural Engine: run every stage on the CPU.
    if let stages = try? request.supportedComputeStageDevices {
      for (stage, devices) in stages {
        if let cpu = devices.first(where: { if case .cpu = $0 { return true } else { return false } }) {
          request.setComputeDevice(cpu, for: stage)
        }
      }
    }
    #endif
    try handler.perform([request])
    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      return ["reason": "no-subject"]
    }
    // Full frame, not cropped to the subject: the picker already framed it at
    // 4:5, so the drink stays where it was shot and every photo keeps one shape.
    let mask = try observation.generateScaledMaskForImage(forInstances: observation.allInstances, from: handler)
    guard let out = composite(image, mask: mask) else { return ["reason": "unreadable"] }

    let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("SubjectCutout", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let file = dir.appendingPathComponent("\(UUID().uuidString).png")
    guard let destination = CGImageDestinationCreateWithURL(file as CFURL, UTType.png.identifier as CFString, 1, nil) else {
      return ["reason": "unwritable"]
    }
    CGImageDestinationAddImage(destination, out, nil)
    guard CGImageDestinationFinalize(destination) else { return ["reason": "unwritable"] }
    return ["uri": file.absoluteString, "width": out.width, "height": out.height]
  }

  /// The photo upright (EXIF orientation applied) and no longer than maxSide.
  private static func load(_ url: URL) -> CGImage? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxSide,
    ]
    return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
  }

  /// The photo's pixels with the mask as straight (not premultiplied) alpha.
  private static func composite(_ image: CGImage, mask: CVPixelBuffer) -> CGImage? {
    let width = image.width
    let height = image.height
    let rowBytes = width * 4
    guard let space = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
    var pixels = [UInt8](repeating: 0, count: rowBytes * height)
    let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: rowBytes, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard drawn else { return nil }

    CVPixelBufferLockBaseAddress(mask, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }
    guard let maskBase = CVPixelBufferGetBaseAddress(mask) else { return nil }
    let maskWidth = CVPixelBufferGetWidth(mask)
    let maskHeight = CVPixelBufferGetHeight(mask)
    let maskRowBytes = CVPixelBufferGetBytesPerRow(mask)

    pixels.withUnsafeMutableBufferPointer { px in
      for y in 0..<height {
        let maskRow = (maskBase + (y * maskHeight / height) * maskRowBytes).assumingMemoryBound(to: Float32.self)
        for x in 0..<width {
          let confidence = min(max(maskRow[x * maskWidth / width], 0), 1)
          let i = y * rowBytes + x * 4
          let alpha = UInt8(confidence * 255 + 0.5)
          px[i + 3] = alpha
          if alpha == 0 {
            px[i] = paper.0
            px[i + 1] = paper.1
            px[i + 2] = paper.2
          }
        }
      }
    }
    guard let provider = CGDataProvider(data: Data(pixels) as CFData) else { return nil }
    return CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: rowBytes, space: space, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue), provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
  }
}
