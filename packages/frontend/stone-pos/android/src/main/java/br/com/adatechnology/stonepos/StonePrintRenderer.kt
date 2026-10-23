/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

// Draws the printable lines as one black-and-white image. The Stone text fonts print faint on the
// P2; an image goes out at full black, like the Stone's own receipts.
object StonePrintRenderer {
    const val PAPER_WIDTH_PX = 384
    private const val BODY_TEXT_PX = 20f
    private const val SMALL_TEXT_PX = 14f
    private const val BIG_TEXT_PX = 34f
    private const val LINE_GAP_PX = 3
    private const val MARGIN_PX = 4

    private val monospaceBold: Typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    private val monospaceRegular: Typeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
    private val sansBold: Typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)

    // The Stone text renderer does not know the bold key: drop it before sending text.
    fun withoutImageOnlyKeys(contentJson: String): String {
        val lines = JSONArray(contentJson)
        for (index in 0 until lines.length()) lines.getJSONObject(index).remove("bold")
        return lines.toString()
    }

    // Returns the PRINTABLE_CONTENT JSON with a single image item.
    fun renderToContentJson(contentJson: String): String {
        val bitmap = render(JSONArray(contentJson))
        val png = ByteArrayOutputStream().use { stream ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            stream.toByteArray()
        }
        bitmap.recycle()
        val image = JSONObject().put("type", "image").put("imagePath", Base64.encodeToString(png, Base64.NO_WRAP))
        return JSONArray().put(image).toString()
    }

    private sealed interface Block {
        val height: Int
        fun draw(canvas: Canvas, top: Int)
    }

    private class TextBlock(private val text: String, private val paint: Paint, private val align: String) : Block {
        override val height: Int = (paint.fontMetricsInt.descent - paint.fontMetricsInt.ascent) + LINE_GAP_PX

        override fun draw(canvas: Canvas, top: Int) {
            val content = if (align == "center") text.trim() else text
            val width = paint.measureText(content)
            val left = when (align) {
                "center" -> (PAPER_WIDTH_PX - width) / 2f
                "right" -> PAPER_WIDTH_PX - width
                else -> 0f
            }
            canvas.drawText(content, left, (top - paint.fontMetricsInt.ascent).toFloat(), paint)
        }
    }

    private class ImageBlock(private val image: Bitmap) : Block {
        override val height: Int = image.height + LINE_GAP_PX

        override fun draw(canvas: Canvas, top: Int) {
            canvas.drawBitmap(image, ((PAPER_WIDTH_PX - image.width) / 2).toFloat(), top.toFloat(), null)
        }
    }

    private fun render(lines: JSONArray): Bitmap {
        val blocks = (0 until lines.length()).mapNotNull { index -> toBlock(lines.getJSONObject(index)) }
        val height = blocks.sumOf { it.height } + MARGIN_PX * 2
        val bitmap = Bitmap.createBitmap(PAPER_WIDTH_PX, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        var top = MARGIN_PX
        for (block in blocks) {
            block.draw(canvas, top)
            top += block.height
        }
        return bitmap
    }

    private fun toBlock(line: JSONObject): Block? = when (line.optString("type")) {
        "image" -> decodeImage(line.optString("imagePath"))?.let { ImageBlock(it) }
        "line" -> TextBlock(line.optString("content"), textPaint(monospaceBold, SMALL_TEXT_PX), "left")
        "text" -> textBlock(line)
        else -> null
    }

    private fun textBlock(line: JSONObject): Block {
        val isBig = line.optString("size") == "big"
        val bodyFace = if (line.optBoolean("bold", true)) monospaceBold else monospaceRegular
        val paint = if (isBig) textPaint(sansBold, BIG_TEXT_PX) else textPaint(bodyFace, BODY_TEXT_PX)
        return TextBlock(line.optString("content"), paint, line.optString("align", "left"))
    }

    // Antialiasing off: every dot is fully black or white, which is what makes the print dark.
    private fun textPaint(typeface: Typeface, size: Float): Paint = Paint().apply {
        this.typeface = typeface
        textSize = size
        color = Color.BLACK
        isAntiAlias = false
    }

    private fun decodeImage(base64: String): Bitmap? {
        if (base64.isBlank()) return null
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }
}
