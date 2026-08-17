import Foundation
import React

/// The `OpenOTA` TurboModule, implemented entirely in Swift as a classic `RCTBridgeModule`.
///
/// Why not the ObjC++ `NativeOpenOTASpecJSI` trampoline pattern originally attempted here: mixing
/// Swift and Objective-C++ sources inside one CocoaPods target requires the ObjC++ file to consume
/// the compiler-generated `<Module>-Swift.h` header, and — verified empirically via `xcodebuild`
/// during this implementation, both with and without `static_framework = true` — Xcode's build
/// graph does not reliably order "finish emitting `OpenOTA-Swift.h`" before "compile OpenOTA.mm"
/// within a single pod target's Compile Sources phase; it intermittently compiles the ObjC++ file
/// against a stale/placeholder header, producing "use of undeclared identifier" errors that are
/// non-deterministic across otherwise-identical builds. Rather than ship a module that fails to
/// build intermittently, this module drops the ObjC++ layer entirely: `RCTBridgeModule` is a plain
/// Objective-C protocol already bridged into Swift by the React headers, so a Swift class can
/// conform to it directly with zero generated-header dependency. Under React Native's New
/// Architecture, `RCTBridgeModule`-conforming classes that don't also provide a JSI `TurboModule`
/// spec are automatically wrapped by RN's Turbo Module *interop layer* — fully functional, with a
/// small (JSON-bridge) call overhead relative to a direct JSI spec. That tradeoff is called out in
/// the phase report's Known Limitations; a future pass can reintroduce the codegen JSI spec once
/// the Swift/ObjC++ build-ordering issue has a confirmed permanent fix (e.g. splitting the ObjC++
/// trampoline into its own pod target that depends on this one, so it builds strictly after it).
@objc(OpenOTA)
final class OpenOTA: NSObject, RCTBridgeModule {
    private let manager: BundleManager
    private let storage: BundleStorage

    static func moduleName() -> String! { "OpenOTA" }

    static func requiresMainQueueSetup() -> Bool { false }

    override init() {
        storage = BundleStorage()
        manager = BundleManager(storage: storage, runtimeVersion: RuntimeVersionSource.resolve())
        super.init()
        Task { await manager.confirmBoot() }
    }

    /// Test-only initializer so XCTest can point the manager at an isolated temp directory instead
    /// of the real Application Support path.
    init(storageRoot: URL, runtimeVersion: String) {
        storage = BundleStorage(root: storageRoot)
        manager = BundleManager(storage: storage, runtimeVersion: runtimeVersion)
        super.init()
    }

    @objc(setBundlePath:resolve:reject:)
    func setBundlePath(_ path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await manager.setBundlePath(path)
                resolve(nil)
            } catch {
                rejectError(error, reject)
            }
        }
    }

    @objc(getBundlePath:reject:)
    func getBundlePath(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            resolve(await manager.getBundlePath())
        }
    }

    @objc(activateBundle:reject:)
    func activateBundle(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let info = try await manager.activateBundle()
                resolve(info.toDictionary())
            } catch {
                rejectError(error, reject)
            }
        }
    }

    @objc(rollback:reject:)
    func rollback(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let info = try await manager.rollbackBundle()
                resolve(info.toDictionary())
            } catch {
                rejectError(error, reject)
            }
        }
    }

    @objc(restart:reject:)
    func restart(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task { @MainActor in
            RestartManager.restart()
            resolve(nil)
        }
    }

    @objc(clearBundle:reject:)
    func clearBundle(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await manager.clearBundle()
                resolve(nil)
            } catch {
                rejectError(error, reject)
            }
        }
    }

    @objc(getRuntimeInfo:reject:)
    func getRuntimeInfo(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            let info = await manager.getRuntimeInfo()
            resolve(info.toDictionary())
        }
    }

    /// Push notifications (APNs) are explicitly out of scope for this phase. These two methods
    /// exist only so JS call sites (see `packages/sdk/src/native/ios.ts`) that unconditionally call
    /// `getFcmToken`/`registerForPushNotifications` never crash: they resolve to a clearly
    /// "not implemented on iOS yet" result instead of throwing, since a null/void resolution is
    /// already treated as a normal "no push available" outcome by the JS layer.
    @objc(getFcmToken:reject:)
    func getFcmToken(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        OpenOTALogger.i("getFcmToken() is not implemented on iOS (APNs/FCM wiring is out of scope for this phase)")
        resolve(nil)
    }

    @objc(registerForPushNotifications:reject:)
    func registerForPushNotifications(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        OpenOTALogger.i("registerForPushNotifications() is a no-op on iOS (APNs wiring is out of scope for this phase)")
        resolve(nil)
    }

    private func rejectError(_ error: Error, _ reject: @escaping RCTPromiseRejectBlock) {
        if let otaError = error as? OpenOTAException {
            OpenOTALogger.e("[\(otaError.code)] \(otaError.message)")
            reject(otaError.code, otaError.message, otaError)
        } else {
            OpenOTALogger.e("Unexpected native error", error: error)
            reject("INTERNAL_ERROR", "An unexpected native error occurred", error)
        }
    }
}

extension RuntimeInfo {
    func toDictionary() -> [String: Any] {
        [
            "currentVersion": currentVersion as Any? ?? NSNull(),
            "bundleVersion": bundleVersion as Any? ?? NSNull(),
            "runtimeVersion": runtimeVersion as Any? ?? NSNull(),
            "manifestVersion": manifestVersion as Any? ?? NSNull(),
            "bundlePath": bundlePath as Any? ?? NSNull(),
            "installTime": installTimeMillis as Any? ?? NSNull(),
            "platform": platform,
            "state": state.rawValue,
        ]
    }
}
