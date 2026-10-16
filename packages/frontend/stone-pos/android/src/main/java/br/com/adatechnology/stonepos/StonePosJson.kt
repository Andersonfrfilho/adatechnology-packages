/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

import org.json.JSONObject

internal fun paymentToJson(result: PaymentResultData): String = JSONObject()
    .put("approved", result.approved)
    .put("cancelledByUser", result.cancelledByUser)
    .putOpt("code", result.code)
    .putOpt("message", result.message)
    .putOpt("amountCents", result.amountCents)
    .putOpt("itk", result.itk)
    .putOpt("atk", result.atk)
    .putOpt("authorizationCode", result.authorizationCode)
    .putOpt("brand", result.brand)
    .putOpt("installmentCount", result.installmentCount)
    .putOpt("type", result.type)
    .putOpt("pan", result.pan)
    .putOpt("entryMode", result.entryMode)
    .putOpt("authorizationDateTime", result.authorizationDateTime)
    .putOpt("orderId", result.orderId)
    .putOpt("instantPaymentId", result.instantPaymentId)
    .putOpt("reason", result.reason)
    .putOpt("responseCode", result.responseCode)
    .put("raw", JSONObject(result.raw))
    .toString()

internal fun cancelToJson(result: CancelResultData): String = JSONObject()
    .put("success", result.success)
    .putOpt("atk", result.atk)
    .putOpt("canceledAmount", result.canceledAmount)
    .putOpt("reason", result.reason)
    .putOpt("responseCode", result.responseCode)
    .put("raw", JSONObject(result.raw))
    .toString()
