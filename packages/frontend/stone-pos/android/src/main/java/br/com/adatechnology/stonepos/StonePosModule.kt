/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import org.json.JSONObject

private enum class OperationKind { PAY, CANCEL, PRINT }

private class PendingOperation(
    val kind: OperationKind,
    val promise: Promise,
    val expectedAmountCents: Long = 0L,
    val isPix: Boolean = false,
    val expectedAtk: String = "",
) {
    var timeoutTask: Runnable? = null
}

class StonePosModule(
    reactContext: ReactApplicationContext,
    private val config: StonePosConfig,
) : NativeStonePosSpec(reactContext) {

    private var pending: PendingOperation? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    init {
        StoneReturnRouter.register { uri -> handleReturn(uri) }
    }

    override fun getName(): String = NAME

    override fun getTypedExportedConstants(): Map<String, Any> =
        mapOf("buildEnvironment" to config.buildEnvironment)

    override fun invalidate() {
        StoneReturnRouter.unregister()
        super.invalidate()
    }

    override fun isAvailable(promise: Promise) {
        val available = SCHEME_PROBES.all { canResolve(it) }
        promise.resolve(available)
    }

    override fun getDeviceInfo(promise: Promise) {
        val info = JSONObject()
            .put("model", Build.MODEL)
            .put("manufacturer", Build.MANUFACTURER)
        promise.resolve(info.toString())
    }

    override fun pay(paramsJson: String, promise: Promise) {
        val operation: PendingOperation
        val uri: String
        try {
            val json = JSONObject(paramsJson)
            val params = PaymentParams(
                amountCents = json.getLong("amountCents"),
                transactionType = json.getString("transactionType"),
                installmentType = json.optString("installmentType", "NONE"),
                installmentCount = if (json.has("installmentCount")) json.getInt("installmentCount") else null,
                orderId = if (json.has("orderId")) json.getString("orderId") else null,
                editableAmount = json.optBoolean("editableAmount", false),
            )
            uri = StoneDeeplink.buildPaymentUri(config.returnScheme, params)
            operation = PendingOperation(
                OperationKind.PAY,
                promise,
                expectedAmountCents = params.amountCents,
                isPix = params.transactionType == "PIX",
            )
        } catch (error: Exception) {
            promise.reject(ERROR_INVALID_PARAMS, error.message, error)
            return
        }
        start(operation, uri)
    }

    override fun cancel(paramsJson: String, promise: Promise) {
        val operation: PendingOperation
        val uri: String
        try {
            val json = JSONObject(paramsJson)
            val params = CancelParams(
                atk = json.getString("atk"),
                amountCents = json.getLong("amountCents"),
            )
            uri = StoneDeeplink.buildCancelUri(config.returnScheme, params)
            operation = PendingOperation(OperationKind.CANCEL, promise, expectedAtk = params.atk)
        } catch (error: Exception) {
            promise.reject(ERROR_INVALID_PARAMS, error.message, error)
            return
        }
        start(operation, uri)
    }

    override fun print(contentJson: String, optionsJson: String, promise: Promise) {
        val operation = PendingOperation(OperationKind.PRINT, promise)
        val uri: String
        val timeoutMs: Long
        try {
            val options = JSONObject(optionsJson.ifBlank { "{}" })
            val printable = printableContent(contentJson, options.optBoolean("renderAsImage", false))
            uri = StoneDeeplink.buildPrintUri(config.returnScheme, printable, options.optBoolean("showFeedback", false))
            timeoutMs = options.optLong("timeoutMs", DEFAULT_PRINT_TIMEOUT_MS)
        } catch (error: Exception) {
            promise.reject(ERROR_INVALID_PARAMS, error.message, error)
            return
        }
        if (!start(operation, uri) || timeoutMs <= 0) return
        val task = Runnable {
            if (release(operation)) {
                promise.reject(ERROR_PRINT_TIMEOUT, "Stone printer did not answer in $timeoutMs ms")
            }
        }
        operation.timeoutTask = task
        mainHandler.postDelayed(task, timeoutMs)
    }

    // Image mode prints dark; when drawing fails the receipt still goes out as text, and the log says why.
    private fun printableContent(contentJson: String, renderAsImage: Boolean): String {
        if (!renderAsImage) {
            Log.i(LOG_TAG, "IMPRESSAO FRACA (texto): modo imagem desligado")
            return StonePrintRenderer.withoutImageOnlyKeys(contentJson)
        }
        return try {
            StonePrintRenderer.renderToContentJson(contentJson).also {
                Log.i(LOG_TAG, "IMPRESSAO FORTE (imagem): ${it.length} bytes")
            }
        } catch (error: Exception) {
            Log.w(LOG_TAG, "IMPRESSAO FRACA (texto): falha ao desenhar a imagem: ${error.javaClass.simpleName}")
            StonePrintRenderer.withoutImageOnlyKeys(contentJson)
        }
    }

    override fun consumeOrphanReturns(promise: Promise) {
        promise.resolve(OrphanReturnStore.consume(reactApplicationContext))
    }

    override fun abandonPendingOperation(promise: Promise) {
        val abandoned = synchronized(this) {
            val current = pending
            pending = null
            current
        }
        abandoned?.let { cancelTimeout(it) }
        abandoned?.promise?.reject(ERROR_ABANDONED, "Operation abandoned")
        promise.resolve(null)
    }

    override fun setKeepScreenOn(enabled: Boolean, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.resolve(null)
            return
        }
        activity.runOnUiThread {
            if (enabled) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
            promise.resolve(null)
        }
    }

    private fun start(operation: PendingOperation, uri: String): Boolean {
        val accepted = synchronized(this) {
            if (pending != null) {
                false
            } else {
                pending = operation
                true
            }
        }
        if (!accepted) {
            operation.promise.reject(ERROR_BUSY, "Another Stone operation is pending")
            return false
        }
        StonePendingService.start(reactApplicationContext)
        try {
            launch(Intent(Intent.ACTION_VIEW, Uri.parse(uri)))
        } catch (error: ActivityNotFoundException) {
            release(operation)
            operation.promise.reject(ERROR_UNAVAILABLE, "Stone app not installed", error)
            return false
        } catch (error: SecurityException) {
            release(operation)
            operation.promise.reject(ERROR_UNAVAILABLE, "Stone app not reachable", error)
            return false
        }
        return true
    }

    private fun launch(intent: Intent) {
        val activity = reactApplicationContext.currentActivity
        if (activity != null) {
            activity.startActivity(intent)
            return
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.applicationContext.startActivity(intent)
    }

    // Clears the slot only while the operation still owns it: false when already resolved, abandoned or timed out.
    private fun release(operation: PendingOperation): Boolean {
        val released = synchronized(this) {
            if (pending === operation) {
                pending = null
                true
            } else {
                false
            }
        }
        if (released) cancelTimeout(operation)
        return released
    }

    // Every operation ends through here (return, timeout, abandon), so the foreground service stops here too.
    private fun cancelTimeout(operation: PendingOperation) {
        operation.timeoutTask?.let { mainHandler.removeCallbacks(it) }
        operation.timeoutTask = null
        StonePendingService.stop(reactApplicationContext)
    }

    private fun handleReturn(uri: Uri) {
        val hinted = StoneDeeplink.returnKindForHost(uri.host)
        val operation = synchronized(this) { pending }
        if (operation == null) {
            // Nothing was asked: never approve, keep it for manual conferencia.
            OrphanReturnStore.save(reactApplicationContext, config.returnScheme, uri)
            return
        }
        if (hinted != null && hinted != operation.kind.name) return
        val result: String?
        try {
            result = evaluate(operation, uri)
        } catch (error: Exception) {
            if (release(operation)) {
                val rawUri = StoneDeeplink.sanitizedReturnUri(config.returnScheme, uri.host, uri.path, uri.encodedQuery)
                operation.promise.reject(ERROR_PARSE, "Could not read the Stone response; rawUri=$rawUri", error)
            }
            return
        }
        if (result != null && release(operation)) operation.promise.resolve(result)
    }

    // Null means the return does not match the pending operation: it is ignored and the slot stays pending.
    private fun evaluate(operation: PendingOperation, uri: Uri): String? {
        val query = StoneDeeplink.parseQuery(uri.encodedQuery)
        return when (operation.kind) {
            OperationKind.PAY -> {
                val payment = StoneDeeplink.parsePaymentResult(query)
                val isAcceptable = StoneDeeplink.isPaymentReturnAcceptable(
                    payment,
                    operation.expectedAmountCents,
                    operation.isPix,
                )
                if (isAcceptable) paymentToJson(payment) else null
            }
            OperationKind.CANCEL -> {
                val cancellation = StoneDeeplink.parseCancelResult(query)
                if (StoneDeeplink.isCancelReturnAcceptable(cancellation, operation.expectedAtk)) {
                    cancelToJson(cancellation)
                } else {
                    null
                }
            }
            OperationKind.PRINT -> {
                val outcome = StoneDeeplink.parsePrintOutcome(query, uri.host, uri.path)
                JSONObject()
                    .put("status", outcome.status)
                    .putOpt("warning", outcome.warning)
                    .put("rawUri", StoneDeeplink.sanitizedReturnUri(config.returnScheme, uri.host, uri.path, uri.encodedQuery))
                    .toString()
            }
        }
    }

    private fun canResolve(probe: String): Boolean {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(probe))
        val packageManager = reactApplicationContext.packageManager
        val matches = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            packageManager.queryIntentActivities(intent, 0)
        }
        return matches.isNotEmpty()
    }

    companion object {
        const val NAME = "StonePos"
        const val LOG_TAG = "StonePosPrint"
        const val ERROR_BUSY = "STONE_BUSY"
        const val ERROR_UNAVAILABLE = "STONE_UNAVAILABLE"
        const val ERROR_INVALID_PARAMS = "STONE_INVALID_PARAMS"
        const val ERROR_PARSE = "STONE_PARSE_ERROR"
        const val ERROR_ABANDONED = "STONE_ABANDONED"
        const val ERROR_PRINT_TIMEOUT = "STONE_PRINT_TIMEOUT"
        const val DEFAULT_PRINT_TIMEOUT_MS = 30_000L
        private val SCHEME_PROBES = listOf("payment-app://pay", "cancel-app://cancel", "printer-app://print")
    }
}
