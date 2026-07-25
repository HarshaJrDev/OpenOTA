package com.openotaplayground

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.openota.runtime.OpenOTAReactHost

// Must exactly match "runtimeVersion" in this app's openota.config.json. Bump both together only
// when a native dependency or native API changes in a way that makes older OTA bundles unsafe to
// run against this binary — see BundleLoader's class doc for why this can't be inferred from
// versionName automatically.
private const val OPENOTA_RUNTIME_VERSION = "1.0.0"

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    // OpenOTAReactHost (not getDefaultReactHost) re-resolves the active OpenOTA bundle on every
    // ReactHost.reload(), not just once at process start — required for the activation/rollback
    // restart to actually serve the newly active bundle instead of replaying whatever was
    // resolved at cold start. See OpenOTAReactHost's class doc for the full explanation.
    OpenOTAReactHost.create(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
      runtimeVersion = OPENOTA_RUNTIME_VERSION,
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
