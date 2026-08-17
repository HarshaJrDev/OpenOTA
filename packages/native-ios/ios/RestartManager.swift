import Foundation
import React

/// iOS has no equivalent of Android's `Activity.recreate()`; the idiomatic "restart" for a React
/// Native app is reloading the JS bundle in place via RN's own reload command, which re-invokes
/// `bundleURL()`/`sourceURL(for:)` on the factory delegate — exactly the hook `OpenOTABundleResolver`
/// uses to pick up a newly-activated bundle. This mirrors `RestartManager.kt`'s intent ("make the
/// newly-activated bundle take effect") without needing a process kill.
enum RestartManager {
    @MainActor
    static func restart() {
        OpenOTALogger.i("Restart requested — triggering RN reload")
        RCTTriggerReloadCommandListeners("OpenOTA restart() called")
    }
}
