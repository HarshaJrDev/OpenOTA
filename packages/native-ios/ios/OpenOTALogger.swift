import Foundation
import os

/// Thin structured-logging wrapper mirroring `OpenOTALogger.kt`. Uses `os.Logger` (unified
/// logging) so spans are visible in Console.app / `xcrun simulator log` without pulling in an
/// observability SDK. `timed(_:_:)` is the extension point a future analytics hook would wrap.
enum OpenOTALogger {
    private static let logger = Logger(subsystem: "com.openota.runtime", category: "OpenOTA")

    static var debugMode: Bool = false

    static func d(_ message: String) {
        if debugMode { logger.debug("\(message, privacy: .public)") }
    }

    static func i(_ message: String) {
        logger.info("\(message, privacy: .public)")
    }

    static func w(_ message: String, error: Error? = nil) {
        if let error {
            logger.warning("\(message, privacy: .public): \(String(describing: error), privacy: .public)")
        } else {
            logger.warning("\(message, privacy: .public)")
        }
    }

    static func e(_ message: String, error: Error? = nil) {
        if let error {
            logger.error("\(message, privacy: .public): \(String(describing: error), privacy: .public)")
        } else {
            logger.error("\(message, privacy: .public)")
        }
    }

    /// Runs `block`, logging its wall-clock duration under `label`. Rethrows on failure.
    static func timed<T>(_ label: String, _ block: () throws -> T) rethrows -> T {
        let start = DispatchTime.now()
        do {
            let result = try block()
            logDuration(label, start: start, success: true)
            return result
        } catch {
            logDuration(label, start: start, success: false)
            throw error
        }
    }

    private static func logDuration(_ label: String, start: DispatchTime, success: Bool) {
        let ms = Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
        i("[\(label)] \(success ? "ok" : "failed") in \(String(format: "%.1f", ms))ms")
    }
}
