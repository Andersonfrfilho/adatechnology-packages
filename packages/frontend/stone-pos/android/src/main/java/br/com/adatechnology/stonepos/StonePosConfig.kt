/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

// Supplied by the host app: returnScheme is the URI scheme its MainActivity declares for the Stone return,
// buildEnvironment is what getConstants().buildEnvironment reports to JS (e.g. BuildConfig.BUILD_ENVIRONMENT).
data class StonePosConfig(
    val returnScheme: String,
    val buildEnvironment: String,
) {
    init {
        require(returnScheme.isNotBlank()) { "returnScheme is required" }
    }
}
