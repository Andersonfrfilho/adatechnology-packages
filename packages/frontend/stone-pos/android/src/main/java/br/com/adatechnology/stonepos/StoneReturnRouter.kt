/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

import android.content.Context
import android.net.Uri

// The host MainActivity forwards every incoming Uri here; the module registers as the receiver.
// Without a receiver nothing can be pending, so the return is stored as an orphan, never approved.
object StoneReturnRouter {
    private var receiver: ((Uri) -> Unit)? = null

    // Returns true when the Uri carries the configured return scheme and was taken.
    @Synchronized
    fun dispatch(context: Context, uri: Uri): Boolean {
        val config = StonePosRuntime.config() ?: return false
        if (uri.scheme != config.returnScheme) return false
        val currentReceiver = receiver
        if (currentReceiver == null) {
            OrphanReturnStore.save(context, config.returnScheme, uri)
            return true
        }
        currentReceiver(uri)
        return true
    }

    @Synchronized
    fun register(newReceiver: (Uri) -> Unit) {
        receiver = newReceiver
    }

    @Synchronized
    fun unregister() {
        receiver = null
    }
}
