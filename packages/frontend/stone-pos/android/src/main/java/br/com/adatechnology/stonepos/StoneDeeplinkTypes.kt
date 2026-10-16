/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

data class PrintOutcome(val status: String, val warning: String?)

data class PaymentParams(
    val amountCents: Long,
    val transactionType: String,
    val installmentType: String = "NONE",
    val installmentCount: Int? = null,
    val orderId: String? = null,
    val editableAmount: Boolean = false,
)

data class CancelParams(
    val atk: String,
    val amountCents: Long,
    val editableAmount: Boolean = false,
)

data class PaymentResultData(
    val approved: Boolean,
    val cancelledByUser: Boolean,
    val code: String?,
    val message: String?,
    val amountCents: Long?,
    val itk: String?,
    val atk: String?,
    val authorizationCode: String?,
    val brand: String?,
    val installmentCount: Int?,
    val type: String?,
    val pan: String?,
    val entryMode: String?,
    val authorizationDateTime: String?,
    val orderId: String?,
    val instantPaymentId: String?,
    val reason: String?,
    val responseCode: String?,
    val raw: Map<String, String>,
)

data class CancelResultData(
    val success: Boolean,
    val atk: String?,
    val canceledAmount: String?,
    val reason: String?,
    val responseCode: String?,
    val raw: Map<String, String>,
)
