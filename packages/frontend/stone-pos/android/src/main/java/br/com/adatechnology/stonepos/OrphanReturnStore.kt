/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

package br.com.adatechnology.stonepos

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject

// Returns that arrived with no matching pending operation (e.g. process died). They never approve anything:
// JS reads them to flag the sale as needing manual conferencia. Card fields are stripped before persisting.
object OrphanReturnStore {
    private const val PREFERENCES_NAME = "stone_pos_orphans"
    private const val KEY_RETURNS = "returns"
    private const val MAX_ORPHANS = 20

    @Synchronized
    fun save(context: Context, returnScheme: String, uri: Uri) {
        val kind = StoneDeeplink.returnKindForHost(uri.host) ?: return
        val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        val stored = JSONArray(preferences.getString(KEY_RETURNS, "[]"))
        val entry = JSONObject()
            .put("kind", kind)
            .put("uri", StoneDeeplink.sanitizedReturnUri(returnScheme, uri.host, uri.path, uri.encodedQuery))
            .put("receivedAt", System.currentTimeMillis())
        val kept = JSONArray()
        val start = maxOf(0, stored.length() - (MAX_ORPHANS - 1))
        for (index in start until stored.length()) kept.put(stored.get(index))
        kept.put(entry)
        preferences.edit().putString(KEY_RETURNS, kept.toString()).apply()
    }

    @Synchronized
    fun consume(context: Context): String {
        val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        val stored = preferences.getString(KEY_RETURNS, "[]") ?: "[]"
        preferences.edit().remove(KEY_RETURNS).apply()
        return stored
    }
}
