package com.openotaplayground

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.openota.runtime.BundleLoader

// Must exactly match "runtimeVersion" in this app's openota.config.json. Bump both together only
// when a native dependency or native API changes in a way that makes older OTA bundles unsafe to
// run against this binary — see BundleLoader's class doc for why this can't be inferred from
// versionName automatically.
private const val OPENOTA_RUNTIME_VERSION = "1.0.0"

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
      // Serves the active OpenOTA bundle when one has been activated; falls back to the bundle
      // embedded in assets (jsBundleFilePath = null) otherwise. See BundleLoader's doc for the
      // crash-safety heuristic this also runs on every cold start.
      jsBundleFilePath = BundleLoader.getJSBundleFile(applicationContext, OPENOTA_RUNTIME_VERSION),
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
