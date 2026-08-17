import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import OpenOTA

// Must match `runtimeVersion` in openota.config.json — the single source of truth iOS uses to
// decide whether a downloaded bundle is compatible with this native binary, mirroring the
// `OPENOTA_RUNTIME_VERSION` constant Android's MainApplication.kt passes into
// `OpenOTAReactHost.create(...)`.
private let openOTARuntimeVersion = "1.0.0"

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    RuntimeVersionSource.runtimeVersion = openOTARuntimeVersion

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "OpenOTAPlayground",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Debug/Metro behavior is untouched — OTA resolution only ever applies to Release, so Fast
    // Refresh and the dev bundle server keep working exactly as before.
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    return OpenOTABundleResolver.bundleURL(
      runtimeVersion: openOTARuntimeVersion,
      embeddedBundleURL: Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    )
#endif
  }
}
