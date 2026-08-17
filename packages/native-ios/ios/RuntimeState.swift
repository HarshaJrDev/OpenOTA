import Foundation

/// Lifecycle states a candidate bundle moves through, mirroring `RuntimeState.kt` 1:1 (including
/// the state *names*, which are persisted verbatim into `state.json` and must round-trip).
enum RuntimeState: String, Codable {
    case embedded = "EMBEDDED"
    case downloaded = "DOWNLOADED"
    case verified = "VERIFIED"
    case extracted = "EXTRACTED"
    case installed = "INSTALLED"
    case activated = "ACTIVATED"
    case failed = "FAILED"
    case rollback = "ROLLBACK"
}

struct IllegalStateTransitionError: Error, CustomStringConvertible {
    let from: RuntimeState
    let to: RuntimeState
    var description: String { "Illegal OpenOTA runtime transition: \(from.rawValue) -> \(to.rawValue)" }
}

/// Enforces the same explicit transition table as `RuntimeStateMachine` in `RuntimeState.kt`.
/// No default/else branch: every edge is a deliberate decision.
enum RuntimeStateMachine {
    private static let allowedTransitions: [RuntimeState: Set<RuntimeState>] = [
        .embedded: [.downloaded],
        .downloaded: [.verified, .failed],
        .verified: [.extracted, .failed],
        .extracted: [.installed, .failed],
        .installed: [.activated, .failed],
        .activated: [.failed, .rollback, .downloaded],
        .failed: [.rollback, .downloaded, .embedded],
        .rollback: [.activated, .embedded, .downloaded, .failed],
    ]

    /// `clearBundle()` may reset to `.embedded` from any state — modeled as an explicit edge from
    /// every state rather than forcing fake intermediate transitions.
    private static let resettableFrom: Set<RuntimeState> = Set([
        RuntimeState.embedded, .downloaded, .verified, .extracted, .installed, .activated, .failed, .rollback,
    ]).subtracting([.embedded])

    static func assertTransition(from: RuntimeState, to: RuntimeState) throws {
        if to == .embedded, resettableFrom.contains(from) { return }
        guard (allowedTransitions[from] ?? []).contains(to) else {
            throw IllegalStateTransitionError(from: from, to: to)
        }
    }
}

/// Thread-safe(-by-serialization) holder for the current `RuntimeState`. All mutation goes
/// through `transition(to:)`, which validates the edge before applying it.
final class RuntimeStateHolder {
    private var _current: RuntimeState
    private let lock = NSLock()

    init(_ initial: RuntimeState) {
        _current = initial
    }

    var current: RuntimeState {
        lock.lock(); defer { lock.unlock() }
        return _current
    }

    @discardableResult
    func transition(to: RuntimeState) throws -> RuntimeState {
        lock.lock(); defer { lock.unlock() }
        try RuntimeStateMachine.assertTransition(from: _current, to: to)
        _current = to
        return _current
    }
}
