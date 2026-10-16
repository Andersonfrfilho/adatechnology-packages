/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder

// Parameter names confirmed in sdkandroid.stone.com.br/reference/*-deeplink.md

const val MAX_AMOUNT_CENTS = 999_999_999L

val PRINT_STATUSES = listOf(
    "SUCCESS",
    "PRINTER_OUT_OF_PAPER",
    "PRINTER_INIT_ERROR",
    "PRINTER_LOW_ENERGY",
    "PRINTER_BUSY",
    "PRINTER_UNSUPPORTED_FORMAT",
    "PRINTER_INVALID_DATA",
    "PRINTER_OVERHEATING",
    "PRINTER_PAPER_JAM",
    "PRINTER_PRINT_ERROR",
)

const val PRINT_STATUS_UNKNOWN = "UNKNOWN"
const val PRINT_STATUS_SUCCESS = "SUCCESS"
const val PRINT_WARNING_UNKNOWN_STATUS = "UNKNOWN_PRINT_STATUS"

const val KIND_PAY = "PAY"
const val KIND_CANCEL = "CANCEL"
const val KIND_PRINT = "PRINT"

// Never leave the native layer: card number and holder name.
private val SENSITIVE_KEYS = setOf("pan", "cardholder_name")

private val PAYMENT_RAW_ALLOW_LIST = setOf(
    "code", "atk", "itk", "authorization_code", "brand", "installment_count", "type", "entry_mode",
    "authorization_date_time", "order_id", "instant_payment_id", "message", "reason", "response_code",
    "amount", "success", "canceledamount",
)

private val CANCEL_RAW_ALLOW_LIST = setOf(
    "success", "atk", "canceledamount", "reason", "responsecode", "code", "message", "amount",
)

object StoneDeeplink {
    private val TRANSACTION_TYPES = setOf("CREDIT", "DEBIT", "PIX", "VOUCHER")
    private val INSTALLMENT_TYPES = setOf("NONE", "MERCHANT", "ISSUER")

    fun buildPaymentUri(returnScheme: String, params: PaymentParams): String {
        validateAmount(params.amountCents)
        require(params.transactionType in TRANSACTION_TYPES) { "Invalid transaction_type: ${params.transactionType}" }
        require(params.installmentType in INSTALLMENT_TYPES) { "Invalid installment_type: ${params.installmentType}" }
        val entries = mutableListOf(
            "return_scheme" to returnScheme,
            "amount" to params.amountCents.toString(),
            "transaction_type" to params.transactionType,
            "installment_type" to params.installmentType,
        )
        if (params.installmentType != "NONE") {
            val count = params.installmentCount
            require(count != null && count in 2..99) { "installment_count must be 2..99" }
            entries.add("installment_count" to count.toString())
        }
        params.orderId?.let { entries.add("order_id" to it) }
        entries.add("editable_amount" to if (params.editableAmount) "1" else "0")
        return "payment-app://pay?" + encodeQuery(entries)
    }

    fun buildCancelUri(returnScheme: String, params: CancelParams): String {
        validateAmount(params.amountCents)
        require(params.atk.isNotBlank()) { "atk is required" }
        // The Stone docs use "returnscheme" in the example and "return_scheme" in the table: send both.
        val entries = listOf(
            "returnscheme" to returnScheme,
            "return_scheme" to returnScheme,
            "atk" to params.atk,
            "amount" to params.amountCents.toString(),
            "editable_amount" to params.editableAmount.toString(),
        )
        return "cancel-app://cancel?" + encodeQuery(entries)
    }

    fun buildPrintUri(returnScheme: String, printableContentJson: String, showFeedbackScreen: Boolean = false): String {
        require(printableContentJson.isNotBlank()) { "printable content is required" }
        val entries = listOf(
            "SHOW_FEEDBACK_SCREEN" to showFeedbackScreen.toString(),
            "SCHEME_RETURN" to returnScheme,
            "PRINTABLE_CONTENT" to printableContentJson,
        )
        return "printer-app://print?" + encodeQuery(entries)
    }

    fun parseQuery(query: String?): Map<String, String> {
        if (query.isNullOrEmpty()) return emptyMap()
        val result = LinkedHashMap<String, String>()
        for (pair in query.split('&')) {
            if (pair.isEmpty()) continue
            val separator = pair.indexOf('=')
            val key = if (separator < 0) pair else pair.substring(0, separator)
            val value = if (separator < 0) "" else pair.substring(separator + 1)
            result[decode(key)] = decode(value)
        }
        return result
    }

    fun parseQueryFromUri(uri: String): Map<String, String> = parseQuery(URI(uri).rawQuery)

    fun parsePaymentResult(query: Map<String, String>): PaymentResultData {
        val code = query["code"]
        return PaymentResultData(
            approved = code == "0",
            cancelledByUser = code == "2",
            code = code,
            message = query["message"],
            amountCents = query["amount"]?.toLongOrNull(),
            itk = query["itk"],
            atk = query["atk"],
            authorizationCode = query["authorization_code"],
            brand = query["brand"],
            installmentCount = query["installment_count"]?.toIntOrNull(),
            type = query["type"],
            pan = maskPan(query["pan"]),
            entryMode = query["entry_mode"],
            authorizationDateTime = query["authorization_date_time"],
            orderId = query["order_id"],
            instantPaymentId = query["instant_payment_id"],
            reason = query["reason"],
            responseCode = query["response_code"],
            raw = filterRaw(query, PAYMENT_RAW_ALLOW_LIST),
        )
    }

    // Approval is only trusted when it matches what was asked: same amount and the identifiers the Stone app issues.
    fun isPaymentReturnAcceptable(result: PaymentResultData, expectedAmountCents: Long, isPix: Boolean): Boolean {
        val code = result.code ?: return false
        if (code != "0") return true
        if (result.amountCents != expectedAmountCents) return false
        if (isPix) return !result.instantPaymentId.isNullOrBlank()
        return !result.itk.isNullOrBlank() && !result.atk.isNullOrBlank()
    }

    fun isCancelReturnAcceptable(result: CancelResultData, expectedAtk: String): Boolean {
        if (!result.success) return true
        return result.atk == null || result.atk == expectedAtk
    }

    fun maskPan(pan: String?): String? {
        if (pan.isNullOrBlank()) return null
        val digits = pan.filter { it.isDigit() }
        if (digits.isEmpty()) return null
        return "****" + digits.takeLast(4)
    }

    fun filterRaw(query: Map<String, String>, allowList: Set<String>): Map<String, String> =
        query.filterKeys { it in allowList && it !in SENSITIVE_KEYS }

    fun returnKindForHost(host: String?): String? = when (host) {
        "pay-response", "payment-response" -> KIND_PAY
        "cancel-response" -> KIND_CANCEL
        "print-response", "printer-response" -> KIND_PRINT
        else -> null
    }

    // Safe to persist or send to JS: sensitive card fields are dropped.
    fun sanitizedReturnUri(returnScheme: String, host: String?, path: String?, rawQuery: String?): String {
        val kept = parseQuery(rawQuery).filterKeys { it.lowercase() !in SENSITIVE_KEYS }
        val base = "$returnScheme://${host.orEmpty()}${path.orEmpty()}"
        return if (kept.isEmpty()) base else base + "?" + encodeQuery(kept.entries.map { it.key to it.value })
    }

    fun parseCancelResult(query: Map<String, String>): CancelResultData = CancelResultData(
        success = query["success"].equals("true", ignoreCase = true),
        atk = query["atk"],
        canceledAmount = query["canceledamount"],
        reason = query["reason"],
        responseCode = query["responsecode"],
        raw = filterRaw(query, CANCEL_RAW_ALLOW_LIST),
    )

    // The query parameter that carries the print status is not documented: look at every value, host and path.
    fun parsePrintResult(query: Map<String, String>, host: String? = null, path: String? = null): String {
        val candidates = query.values.toList() + listOfNotNull(host, path?.trim('/'))
        for (candidate in candidates) {
            val normalized = candidate.trim().uppercase()
            if (normalized in PRINT_STATUSES) return normalized
        }
        return PRINT_STATUS_UNKNOWN
    }

    // An undocumented return without status and without error hint counts as printed, flagged with a warning.
    fun parsePrintOutcome(query: Map<String, String>, host: String? = null, path: String? = null): PrintOutcome {
        val status = parsePrintResult(query, host, path)
        if (status != PRINT_STATUS_UNKNOWN) return PrintOutcome(status, null)
        val hasErrorHint = query.keys.any { it.lowercase().contains("error") }
        if (hasErrorHint) return PrintOutcome(PRINT_STATUS_UNKNOWN, null)
        return PrintOutcome(PRINT_STATUS_SUCCESS, PRINT_WARNING_UNKNOWN_STATUS)
    }

    private fun validateAmount(amountCents: Long) {
        require(amountCents in 1..MAX_AMOUNT_CENTS) { "amount must be an integer between 1 and $MAX_AMOUNT_CENTS" }
    }

    private fun encodeQuery(entries: List<Pair<String, String>>): String =
        entries.joinToString("&") { (key, value) -> "${encode(key)}=${encode(value)}" }

    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")

    private fun decode(value: String): String = URLDecoder.decode(value, "UTF-8")
}
