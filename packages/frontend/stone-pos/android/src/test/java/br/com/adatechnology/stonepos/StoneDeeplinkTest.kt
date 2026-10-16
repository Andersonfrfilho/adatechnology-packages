/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

private const val SCHEME = "comandada"

class StoneDeeplinkTest {

    @Test
    fun buildsCreditPaymentUri() {
        val uri = StoneDeeplink.buildPaymentUri(SCHEME, PaymentParams(amountCents = 14300, transactionType = "CREDIT"))
        assertEquals(
            "payment-app://pay?return_scheme=comandada&amount=14300&transaction_type=CREDIT" +
                "&installment_type=NONE&editable_amount=0",
            uri,
        )
    }

    @Test
    fun buildsInstallmentPaymentUriWithOrderId() {
        val uri = StoneDeeplink.buildPaymentUri(
            SCHEME,
            PaymentParams(
                amountCents = 9600,
                transactionType = "CREDIT",
                installmentType = "MERCHANT",
                installmentCount = 3,
                orderId = "27",
            ),
        )
        assertEquals(
            "payment-app://pay?return_scheme=comandada&amount=9600&transaction_type=CREDIT" +
                "&installment_type=MERCHANT&installment_count=3&order_id=27&editable_amount=0",
            uri,
        )
    }

    @Test
    fun rejectsInvalidAmounts() {
        listOf(0L, -1L, 1_000_000_000L).forEach { amount ->
            try {
                StoneDeeplink.buildPaymentUri(SCHEME, PaymentParams(amountCents = amount, transactionType = "PIX"))
                fail("amount $amount should be rejected")
            } catch (expected: IllegalArgumentException) {
                assertTrue(expected.message!!.contains("amount"))
            }
        }
        StoneDeeplink.buildPaymentUri(SCHEME, PaymentParams(amountCents = 999_999_999L, transactionType = "PIX"))
    }

    @Test
    fun rejectsInstallmentsOutOfRange() {
        try {
            StoneDeeplink.buildPaymentUri(
                SCHEME,
                PaymentParams(
                    amountCents = 1000,
                    transactionType = "CREDIT",
                    installmentType = "ISSUER",
                    installmentCount = 1,
                ),
            )
            fail("installment_count 1 should be rejected")
        } catch (expected: IllegalArgumentException) {
            assertTrue(expected.message!!.contains("installment_count"))
        }
    }

    @Test
    fun usesTheConfiguredReturnScheme() {
        val uri = StoneDeeplink.buildPaymentUri("other-app", PaymentParams(amountCents = 100, transactionType = "PIX"))
        assertTrue(uri.contains("return_scheme=other-app"))
        assertEquals("other-app://pay-response?code=0", StoneDeeplink.sanitizedReturnUri("other-app", "pay-response", "", "code=0"))
    }

    @Test
    fun buildsCancelUriWithBothReturnSchemeNames() {
        val uri = StoneDeeplink.buildCancelUri(SCHEME, CancelParams(atk = "ABC123", amountCents = 15000))
        assertEquals(
            "cancel-app://cancel?returnscheme=comandada&return_scheme=comandada&atk=ABC123" +
                "&amount=15000&editable_amount=false",
            uri,
        )
    }

    @Test
    fun buildsPrintUriWithEncodedContent() {
        val uri = StoneDeeplink.buildPrintUri(SCHEME, """[{"type":"line","content":"A B"}]""")
        assertEquals(
            "printer-app://print?SHOW_FEEDBACK_SCREEN=false&SCHEME_RETURN=comandada" +
                "&PRINTABLE_CONTENT=%5B%7B%22type%22%3A%22line%22%2C%22content%22%3A%22A%20B%22%7D%5D",
            uri,
        )
        val decoded = StoneDeeplink.parseQueryFromUri(uri)
        assertEquals("""[{"type":"line","content":"A B"}]""", decoded["PRINTABLE_CONTENT"])
    }

    @Test
    fun parsesApprovedPayment() {
        val query = StoneDeeplink.parseQuery(
            "code=0&amount=14300&itk=ITK1&atk=ATK1&authorization_code=123456&brand=VISA" +
                "&installment_count=1&type=CREDIT&pan=1234&entry_mode=CHIP" +
                "&authorization_date_time=2026-10-16T12%3A00%3A00&cardholder_name=JOAO%20SILVA&order_id=27",
        )
        val result = StoneDeeplink.parsePaymentResult(query)
        assertTrue(result.approved)
        assertFalse(result.cancelledByUser)
        assertEquals(14300L, result.amountCents)
        assertEquals("ATK1", result.atk)
        assertEquals("VISA", result.brand)
        assertEquals("2026-10-16T12:00:00", result.authorizationDateTime)
        assertEquals("****1234", result.pan)
        assertEquals(1, result.installmentCount)
        assertFalse(result.raw.containsKey("pan"))
        assertFalse(result.raw.containsKey("cardholder_name"))
        assertEquals("ATK1", result.raw["atk"])
    }

    @Test
    fun masksPanKeepingOnlyLastFourDigits() {
        assertEquals("****4321", StoneDeeplink.maskPan("5555 4444 3333 4321"))
        assertNull(StoneDeeplink.maskPan(null))
        assertNull(StoneDeeplink.maskPan(""))
    }

    @Test
    fun dropsUnknownKeysFromRaw() {
        val result = StoneDeeplink.parsePaymentResult(
            StoneDeeplink.parseQuery("code=0&amount=100&pan=4111111111111111&track2=SECRET&cardholder_name=A"),
        )
        assertEquals(setOf("code", "amount"), result.raw.keys)
    }

    @Test
    fun acceptsApprovalOnlyWhenAmountAndIdentifiersMatch() {
        fun result(query: String) = StoneDeeplink.parsePaymentResult(StoneDeeplink.parseQuery(query))
        val approved = result("code=0&amount=14300&itk=ITK1&atk=ATK1")
        assertTrue(StoneDeeplink.isPaymentReturnAcceptable(approved, 14300L, isPix = false))
        assertFalse(StoneDeeplink.isPaymentReturnAcceptable(approved, 14301L, isPix = false))
        assertFalse(StoneDeeplink.isPaymentReturnAcceptable(result("code=0&amount=14300&atk=ATK1"), 14300L, false))
        assertFalse(StoneDeeplink.isPaymentReturnAcceptable(result("code=0&amount=14300&itk=ITK1"), 14300L, false))
        assertFalse(StoneDeeplink.isPaymentReturnAcceptable(result("code=0&amount=14300&itk=&atk="), 14300L, false))
        assertFalse(StoneDeeplink.isPaymentReturnAcceptable(result("amount=14300"), 14300L, false))
    }

    @Test
    fun acceptsPixApprovalOnlyWithInstantPaymentId() {
        val withId = StoneDeeplink.parsePaymentResult(
            StoneDeeplink.parseQuery("code=0&amount=5000&instant_payment_id=E2E1"),
        )
        val withoutId = StoneDeeplink.parsePaymentResult(StoneDeeplink.parseQuery("code=0&amount=5000&itk=I&atk=A"))
        assertTrue(StoneDeeplink.isPaymentReturnAcceptable(withId, 5000L, isPix = true))
        assertFalse(StoneDeeplink.isPaymentReturnAcceptable(withoutId, 5000L, isPix = true))
    }

    @Test
    fun acceptsRefusalWithoutAmountOrIdentifiers() {
        val declined = StoneDeeplink.parsePaymentResult(StoneDeeplink.parseQuery("code=-6&reason=1016"))
        val closed = StoneDeeplink.parsePaymentResult(StoneDeeplink.parseQuery("code=2"))
        assertTrue(StoneDeeplink.isPaymentReturnAcceptable(declined, 999L, isPix = false))
        assertTrue(StoneDeeplink.isPaymentReturnAcceptable(closed, 999L, isPix = false))
    }

    @Test
    fun rejectsCancelSuccessForAnotherAtk() {
        val cancelled = StoneDeeplink.parseCancelResult(StoneDeeplink.parseQuery("success=true&atk=OTHER"))
        assertFalse(StoneDeeplink.isCancelReturnAcceptable(cancelled, "ATK1"))
        assertTrue(StoneDeeplink.isCancelReturnAcceptable(cancelled, "OTHER"))
    }

    @Test
    fun sanitizedReturnUriDropsCardFields() {
        val uri = StoneDeeplink.sanitizedReturnUri(
            SCHEME,
            "pay-response",
            "",
            "code=0&pan=4111111111111111&cardholder_name=JOAO%20SILVA&amount=100",
        )
        assertEquals("comandada://pay-response?code=0&amount=100", uri)
    }

    @Test
    fun mapsReturnHostsToKinds() {
        assertEquals("PAY", StoneDeeplink.returnKindForHost("pay-response"))
        assertEquals("CANCEL", StoneDeeplink.returnKindForHost("cancel-response"))
        assertEquals("PRINT", StoneDeeplink.returnKindForHost("print-response"))
        assertNull(StoneDeeplink.returnKindForHost("evil"))
    }

    @Test
    fun treatsPrintReturnWithoutStatusAsSuccessWithWarning() {
        val outcome = StoneDeeplink.parsePrintOutcome(StoneDeeplink.parseQuery("x=y"))
        assertEquals("SUCCESS", outcome.status)
        assertEquals("UNKNOWN_PRINT_STATUS", outcome.warning)
        val failed = StoneDeeplink.parsePrintOutcome(StoneDeeplink.parseQuery("error=boom"))
        assertEquals("UNKNOWN", failed.status)
        assertNull(failed.warning)
    }

    @Test
    fun parsesPaymentClosedByUser() {
        val result = StoneDeeplink.parsePaymentResult(StoneDeeplink.parseQuery("code=2"))
        assertFalse(result.approved)
        assertTrue(result.cancelledByUser)
    }

    @Test
    fun parsesDeclinedPayment() {
        val result = StoneDeeplink.parsePaymentResult(
            StoneDeeplink.parseQuery("code=-6&reason=1016&message=Transa%C3%A7%C3%A3o%20recusada&response_code=51"),
        )
        assertFalse(result.approved)
        assertFalse(result.cancelledByUser)
        assertEquals("-6", result.code)
        assertEquals("1016", result.reason)
        assertEquals("Transação recusada", result.message)
        assertEquals("51", result.responseCode)
    }

    @Test
    fun parsesPixPaymentWithInstantPaymentId() {
        val result = StoneDeeplink.parsePaymentResult(
            StoneDeeplink.parseQuery("code=0&type=INSTANT_PAYMENT&instant_payment_id=E2E123&amount=5000"),
        )
        assertTrue(result.approved)
        assertEquals("INSTANT_PAYMENT", result.type)
        assertEquals("E2E123", result.instantPaymentId)
        assertNull(result.atk)
    }

    @Test
    fun parsesSuccessfulCancel() {
        val result = StoneDeeplink.parseCancelResult(
            StoneDeeplink.parseQuery("success=true&atk=ATK1&canceledamount=15000&responsecode=0"),
        )
        assertTrue(result.success)
        assertEquals("ATK1", result.atk)
        assertEquals("15000", result.canceledAmount)
    }

    @Test
    fun parsesAbortedCancel() {
        val result = StoneDeeplink.parseCancelResult(
            StoneDeeplink.parseQuery("success=false&reason=7011&responsecode=7011"),
        )
        assertFalse(result.success)
        assertEquals("7011", result.reason)
    }

    @Test
    fun parsesPrintStatusFromAnyValueHostOrPath() {
        assertEquals(
            "PRINTER_OUT_OF_PAPER",
            StoneDeeplink.parsePrintResult(StoneDeeplink.parseQuery("status=PRINTER_OUT_OF_PAPER")),
        )
        assertEquals(
            "SUCCESS",
            StoneDeeplink.parsePrintResult(StoneDeeplink.parseQuery("whatever=success")),
        )
        assertEquals("PRINTER_BUSY", StoneDeeplink.parsePrintResult(emptyMap(), host = "PRINTER_BUSY"))
        assertEquals("PRINTER_PAPER_JAM", StoneDeeplink.parsePrintResult(emptyMap(), path = "/PRINTER_PAPER_JAM"))
        assertEquals("UNKNOWN", StoneDeeplink.parsePrintResult(StoneDeeplink.parseQuery("x=y")))
    }
}
