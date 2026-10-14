package expo.modules.subjectcutout

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.roundToInt

/** Long side of the PNG; see the iOS module for why. */
private const val MAX_SIDE = 1440

/**
 * The drawn-drink paper (#EFE9DD) under fully clear pixels, so the image-palette
 * worker's JPEG thumbnail (which drops alpha) shows paper there, not black.
 * ponytail: flatten in supabase/functions/_shared/thumbnail.ts once that's deployed.
 */
private val PAPER = Color.rgb(0xEF, 0xE9, 0xDD) and 0x00FFFFFF

/**
 * Lifts the subject (the drink) out of a photo on the device with ML Kit
 * subject segmentation, and writes it as a PNG with alpha to the cache
 * directory. The model is unbundled: until Play services has downloaded it,
 * this resolves { reason: "model-downloading" } and asks for the download, so
 * the next photo gets the offer.
 * ponytail: not fetched at install (the com.google.mlkit.vision.DEPENDENCIES
 * manifest entry clashes with expo-dev-launcher's in dev builds); a release-only
 * config plugin could add it if the first-photo miss matters.
 */
class SubjectCutoutModule : Module() {
  private val worker = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("SubjectCutout")

    Function("isSupported") { true }

    AsyncFunction("cutout") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(mapOf("reason" to "unavailable"))
        return@AsyncFunction
      }
      worker.execute { run(context, uri, promise) }
    }

    OnDestroy { worker.shutdown() }
  }

  private fun run(context: Context, uri: String, promise: Promise) {
    val photo = try {
      load(context, Uri.parse(uri))
    } catch (e: Exception) {
      null
    }
    if (photo == null) {
      promise.resolve(mapOf("reason" to "unreadable"))
      return
    }
    val segmenter = SubjectSegmentation.getClient(
      SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build()
    )
    segmenter.process(InputImage.fromBitmap(photo, 0))
      .addOnSuccessListener(worker) { result ->
        val mask = result.foregroundConfidenceMask
        if (mask == null) {
          promise.resolve(mapOf("reason" to "no-subject"))
          return@addOnSuccessListener
        }
        val width = photo.width
        val height = photo.height
        val pixels = IntArray(width * height)
        photo.getPixels(pixels, 0, width, 0, 0, width, height)
        var subject = false
        for (i in pixels.indices) {
          val alpha = (mask.get(i).coerceIn(0f, 1f) * 255f).roundToInt()
          if (alpha >= 128) subject = true
          pixels[i] = if (alpha == 0) PAPER else (alpha shl 24) or (pixels[i] and 0x00FFFFFF)
        }
        if (!subject) {
          promise.resolve(mapOf("reason" to "no-subject"))
          return@addOnSuccessListener
        }
        // Straight alpha, so clear pixels keep the paper colour in the file.
        val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        out.isPremultiplied = false
        out.setPixels(pixels, 0, width, 0, 0, width, height)
        val dir = File(context.cacheDir, "SubjectCutout").apply { mkdirs() }
        val file = File(dir, "${UUID.randomUUID()}.png")
        file.outputStream().use { out.compress(Bitmap.CompressFormat.PNG, 100, it) }
        promise.resolve(mapOf("uri" to Uri.fromFile(file).toString(), "width" to width, "height" to height))
      }
      .addOnFailureListener(worker) { error ->
        if (error is MlKitException && error.errorCode == MlKitException.UNAVAILABLE) {
          // The model isn't on the phone yet: ask Play services for it and keep the original for now.
          ModuleInstall.getClient(context).installModules(ModuleInstallRequest.newBuilder().addApi(segmenter).build())
          promise.resolve(mapOf("reason" to "model-downloading"))
        } else {
          promise.resolve(mapOf("reason" to "failed"))
        }
      }
  }

  /** The photo upright (EXIF orientation applied) and no longer than MAX_SIDE. */
  private fun load(context: Context, uri: Uri): Bitmap? {
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
    val decoded = resolver.openInputStream(uri)?.use {
      BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: return null
    val orientation = resolver.openInputStream(uri)?.use {
      ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    } ?: ExifInterface.ORIENTATION_NORMAL
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
    }
    val longSide = max(decoded.width, decoded.height)
    if (longSide > MAX_SIDE) {
      val scale = MAX_SIDE.toFloat() / longSide
      matrix.postScale(scale, scale)
    }
    return Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
  }
}
