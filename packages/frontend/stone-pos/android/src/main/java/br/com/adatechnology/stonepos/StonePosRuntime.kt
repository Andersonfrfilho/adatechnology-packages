/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

// The host app calls configure() once in Application.onCreate. The autolinked StonePosPackage and the
// StoneReturnRouter (fed by MainActivity, possibly on a cold start) both read the config from here.
object StonePosRuntime {
    @Volatile
    private var current: StonePosConfig? = null

    fun configure(config: StonePosConfig) {
        current = config
    }

    fun config(): StonePosConfig? = current

    fun requireConfig(): StonePosConfig =
        checkNotNull(current) { "Call StonePosRuntime.configure(StonePosConfig(...)) in Application.onCreate" }
}
