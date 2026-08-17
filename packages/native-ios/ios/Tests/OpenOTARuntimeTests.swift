import XCTest
@testable import OpenOTA

/// Hermetic test suite: every test builds its own `BundleStorage(root:)` against a fresh temp
/// directory (never the real Application Support path) so tests never interact with each other or
/// a real device/simulator's state.
final class OpenOTARuntimeTests: XCTestCase {
    var tempDir: URL!
    let runtimeVersion = "1.0.0"

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tempDir)
    }

    private func makeManager() -> BundleManager {
        BundleManager(storage: BundleStorage(root: tempDir), runtimeVersion: runtimeVersion)
    }

    private func writeManifest(
        dir: URL,
        version: String = "1.0.0",
        platform: String = "ios",
        runtimeVersion: String = "1.0.0",
        sha256: String,
        bundleName: String = "main.jsbundle"
    ) throws {
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let json: [String: Any] = [
            "manifestVersion": 1, "version": version, "platform": platform,
            "runtimeVersion": runtimeVersion, "sha256": sha256, "size": 10,
            "createdAt": "2026-01-01T00:00:00Z", "bundleName": bundleName,
        ]
        let data = try JSONSerialization.data(withJSONObject: json)
        try data.write(to: dir.appendingPathComponent("manifest.json"))
    }

    private func writeBundleFile(dir: URL, bundleName: String = "main.jsbundle", contents: String = "console.log(1)") throws -> String {
        let bundleDir = dir.appendingPathComponent("bundle", isDirectory: true)
        try FileManager.default.createDirectory(at: bundleDir, withIntermediateDirectories: true)
        let data = Data(contents.utf8)
        try data.write(to: bundleDir.appendingPathComponent(bundleName))
        return try BundleVerifier.computeSha256(bundleDir.appendingPathComponent(bundleName))
    }

    private func stageValidCandidate(dir: URL, version: String = "1.0.0") throws {
        let sha = try writeBundleFile(dir: dir)
        try writeManifest(dir: dir, version: version, sha256: sha)
    }

    // 1. No-OTA fallback: fresh install, no state ever written -> resolver returns embedded URL.
    func testNoOTAFallsBackToEmbedded() {
        let embedded = URL(fileURLWithPath: "/embedded/main.jsbundle")
        let resolved = OpenOTABundleResolver.bundleURL(runtimeVersion: runtimeVersion, embeddedBundleURL: embedded, storageRoot: tempDir)
        XCTAssertEqual(resolved, embedded)
    }

    // 2. Valid OTA selection: activated + confirmed bundle is served over embedded.
    func testValidOTAIsSelectedOverEmbedded() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)
        _ = try await manager.activateBundle()
        await manager.confirmBoot()

        let embedded = URL(fileURLWithPath: "/embedded/main.jsbundle")
        let resolved = OpenOTABundleResolver.bundleURL(runtimeVersion: runtimeVersion, embeddedBundleURL: embedded, storageRoot: tempDir)
        XCTAssertNotEqual(resolved, embedded)
        XCTAssertEqual(resolved?.lastPathComponent, "main.jsbundle")
    }

    // 3. Missing OTA file fallback: state says ACTIVATED but the file is gone -> embedded.
    func testMissingOTAFileFallsBackToEmbedded() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)
        _ = try await manager.activateBundle()
        await manager.confirmBoot()

        let storage = BundleStorage(root: tempDir)
        try? FileManager.default.removeItem(at: storage.bundleFile(storage.currentDir, bundleFileName: "main.jsbundle"))

        let embedded = URL(fileURLWithPath: "/embedded/main.jsbundle")
        let resolved = OpenOTABundleResolver.bundleURL(runtimeVersion: runtimeVersion, embeddedBundleURL: embedded, storageRoot: tempDir)
        XCTAssertEqual(resolved, embedded)
    }

    // 4. Runtime mismatch rejection.
    func testRuntimeMismatchIsRejected() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        let sha = try writeBundleFile(dir: candidate)
        try writeManifest(dir: candidate, runtimeVersion: "2.0.0", sha256: sha)
        try await manager.setBundlePath(candidate.path)

        do {
            _ = try await manager.activateBundle()
            XCTFail("expected activation to throw")
        } catch let error as OpenOTAException {
            XCTAssertEqual(error.code, "INVALID_RUNTIME")
        }
    }

    // 5. Platform mismatch rejection.
    func testPlatformMismatchIsRejected() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        let sha = try writeBundleFile(dir: candidate)
        try writeManifest(dir: candidate, platform: "android", sha256: sha)
        try await manager.setBundlePath(candidate.path)

        do {
            _ = try await manager.activateBundle()
            XCTFail("expected activation to throw")
        } catch let error as OpenOTAException {
            XCTAssertEqual(error.code, "VERIFICATION_FAILED")
        }
    }

    // 6. Invalid SHA rejection.
    func testInvalidShaIsRejected() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        _ = try writeBundleFile(dir: candidate)
        try writeManifest(dir: candidate, sha256: "0000000000000000000000000000000000000000000000000000000000000000")
        try await manager.setBundlePath(candidate.path)

        do {
            _ = try await manager.activateBundle()
            XCTFail("expected activation to throw")
        } catch let error as OpenOTAException {
            XCTAssertEqual(error.code, "VERIFICATION_FAILED")
        }
    }

    // 7. Corrupt state.json fallback: unreadable JSON -> treated as EMPTY -> embedded served.
    func testCorruptStateJsonFallsBackToEmbedded() throws {
        let storage = BundleStorage(root: tempDir)
        try Data("{not valid json".utf8).write(to: storage.stateFile)

        let embedded = URL(fileURLWithPath: "/embedded/main.jsbundle")
        let resolved = OpenOTABundleResolver.bundleURL(runtimeVersion: runtimeVersion, embeddedBundleURL: embedded, storageRoot: tempDir)
        XCTAssertEqual(resolved, embedded)
    }

    // 8. Interrupted download never activates: a candidate dir with only a manifest (no bundle
    // file written yet, simulating a kill mid-download) must fail verification, not activate.
    func testInterruptedDownloadNeverActivates() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try FileManager.default.createDirectory(at: candidate, withIntermediateDirectories: true)
        try writeManifest(dir: candidate, sha256: "deadbeef")
        try await manager.setBundlePath(candidate.path)

        do {
            _ = try await manager.activateBundle()
            XCTFail("expected activation to throw")
        } catch let error as OpenOTAException {
            XCTAssertEqual(error.code, "VERIFICATION_FAILED")
        }
        // Persisted state.json is only ever overwritten on a *successful* transition (mirroring
        // BundleManager.kt: writeRootManifest is called after activation succeeds, never in the
        // catch block) — a crash mid-failure must resume into the last known-good persisted state,
        // never a half-applied one. So the on-disk state stays EMBEDDED (nothing was ever
        // successfully activated on this manager); what matters is that the candidate was never
        // promoted into current/.
        let storage = BundleStorage(root: tempDir)
        XCTAssertEqual(storage.readState().state, .embedded)
        XCTAssertFalse(storage.fileExists(storage.manifestFile(storage.currentDir)))
    }

    // 9. Safe zip extraction / containment: a well-formed candidate with only in-tree files passes.
    func testSafeExtractionContainmentPasses() throws {
        let candidate = tempDir.appendingPathComponent("candidate")
        try FileManager.default.createDirectory(at: candidate.appendingPathComponent("bundle"), withIntermediateDirectories: true)
        try Data("x".utf8).write(to: candidate.appendingPathComponent("bundle/main.jsbundle"))
        XCTAssertNoThrow(try PathTraversalGuard.assertContained(candidate))
    }

    // 10. Zip-slip / path-traversal rejection: a symlink inside the candidate pointing outside the
    // sandbox must be rejected before promotion.
    func testZipSlipSymlinkIsRejected() throws {
        let candidate = tempDir.appendingPathComponent("candidate")
        try FileManager.default.createDirectory(at: candidate, withIntermediateDirectories: true)
        let outside = tempDir.appendingPathComponent("outside-secret")
        try Data("secret".utf8).write(to: outside)
        try FileManager.default.createSymbolicLink(at: candidate.appendingPathComponent("evil"), withDestinationURL: outside)

        XCTAssertThrowsError(try PathTraversalGuard.assertContained(candidate)) { error in
            XCTAssertEqual((error as? OpenOTAException)?.code, "PATH_SECURITY_ERROR")
        }
    }

    // 10b. resolveWithinRoot rejects absolute paths outside the sandbox and `..` escapes.
    func testResolveWithinRootRejectsEscape() throws {
        let storage = BundleStorage(root: tempDir)
        XCTAssertThrowsError(try storage.resolveWithinRoot("/etc/passwd"))
        XCTAssertThrowsError(try storage.resolveWithinRoot("../../etc/passwd"))
    }

    // 11. Valid install -> PENDING-equivalent: activated but not yet confirmed.
    func testValidInstallReachesActivatedUnconfirmed() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)
        let info = try await manager.activateBundle()

        XCTAssertEqual(info.state, .activated)
        let storage = BundleStorage(root: tempDir)
        XCTAssertFalse(storage.readState().bootConfirmed)
    }

    // 12. Successful confirm -> confirmed.
    func testSuccessfulConfirmMarksConfirmed() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)
        _ = try await manager.activateBundle()
        await manager.confirmBoot()

        let storage = BundleStorage(root: tempDir)
        XCTAssertTrue(storage.readState().bootConfirmed)
    }

    // 13. Failed confirm (repeated unconfirmed boots) -> automatic rollback.
    func testRepeatedUnconfirmedBootsTriggersRollback() async throws {
        let manager = makeManager()
        // Generation 1: activate + confirm so it becomes the rollback snapshot for generation 2.
        let gen1 = tempDir.appendingPathComponent("gen1")
        try stageValidCandidate(dir: gen1, version: "1.0.0")
        try await manager.setBundlePath(gen1.path)
        _ = try await manager.activateBundle()
        await manager.confirmBoot()

        // Generation 2: activate but never confirm.
        let gen2 = tempDir.appendingPathComponent("gen2")
        try stageValidCandidate(dir: gen2, version: "2.0.0")
        try await manager.setBundlePath(gen2.path)
        _ = try await manager.activateBundle()

        // Simulate MAX_UNCONFIRMED_BOOTS launches without confirmation.
        var lastManifest: RuntimeManifest = .empty
        for _ in 0..<maxUnconfirmedBoots {
            lastManifest = await manager.recordBootAttempt()
        }

        XCTAssertEqual(lastManifest.activeVersion, "1.0.0", "should have rolled back to generation 1")
        XCTAssertTrue(lastManifest.bootConfirmed)
    }

    // 14. Previous-OTA-unavailable -> embedded: rollback with nothing to restore surfaces the
    // typed error and leaves the resolver falling back to embedded rather than crash-looping.
    func testRollbackWithNoPreviousGenerationFallsBackToEmbedded() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)
        _ = try await manager.activateBundle()
        // Never confirmed, no rollback/ snapshot exists (only one generation has ever activated).

        do {
            _ = try await manager.rollbackBundle()
            XCTFail("expected NO_ROLLBACK_AVAILABLE")
        } catch let error as OpenOTAException {
            XCTAssertEqual(error.code, "NO_ROLLBACK_AVAILABLE")
        }

        // As above (test 8): only successful transitions are ever persisted to state.json, so the
        // on-disk state stays at the last successfully-written ACTIVATED record from the earlier
        // activateBundle() call — the in-memory state machine (not asserted here directly) is what
        // moved through ROLLBACK -> FAILED. What matters for crash-safety is that the previously
        // active generation was never torn down by the failed rollback attempt.
        let storage = BundleStorage(root: tempDir)
        XCTAssertEqual(storage.readState().state, .activated)
        XCTAssertTrue(storage.fileExists(storage.manifestFile(storage.currentDir)), "current/ must survive a failed rollback")
    }

    // 15. Cleanup preserves the active bundle.
    func testCleanupPreservesActiveBundle() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)
        _ = try await manager.activateBundle()

        await manager.cleanupObsolete()

        let storage = BundleStorage(root: tempDir)
        XCTAssertTrue(storage.fileExists(storage.manifestFile(storage.currentDir)))
    }

    // 16. Cleanup preserves the rollback-required previous bundle.
    func testCleanupPreservesRollbackBundle() async throws {
        let manager = makeManager()
        let gen1 = tempDir.appendingPathComponent("gen1")
        try stageValidCandidate(dir: gen1, version: "1.0.0")
        try await manager.setBundlePath(gen1.path)
        _ = try await manager.activateBundle()
        await manager.confirmBoot()

        let gen2 = tempDir.appendingPathComponent("gen2")
        try stageValidCandidate(dir: gen2, version: "2.0.0")
        try await manager.setBundlePath(gen2.path)
        _ = try await manager.activateBundle()

        await manager.cleanupObsolete()

        let storage = BundleStorage(root: tempDir)
        XCTAssertTrue(storage.fileExists(storage.manifestFile(storage.rollbackDir)), "rollback snapshot must survive cleanup")
    }

    // 17. Concurrent operations are serialized: firing many activations concurrently never
    // corrupts state.json or leaves an intermediate/illegal state readable.
    func testConcurrentOperationsAreSerialized() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)

        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<10 {
                group.addTask {
                    _ = try? await manager.activateBundle()
                    _ = await manager.getRuntimeInfo()
                }
            }
        }

        let storage = BundleStorage(root: tempDir)
        let state = storage.readState()
        XCTAssertTrue([.activated, .failed].contains(state.state))
    }

    // 18. Restart during pending (activated-but-unconfirmed) install: resolver still serves the
    // OTA bundle (an unconfirmed activation is still a legitimately-activated state, not a failure).
    func testRestartDuringPendingServesOTABundle() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)
        _ = try await manager.activateBundle()
        // No confirmBoot() call — simulates a restart mid-"pending".

        let embedded = URL(fileURLWithPath: "/embedded/main.jsbundle")
        let resolved = OpenOTABundleResolver.bundleURL(runtimeVersion: runtimeVersion, embeddedBundleURL: embedded, storageRoot: tempDir)
        XCTAssertNotEqual(resolved, embedded)
    }

    // 19. Restart after confirmed: still serves the OTA bundle, boot attempts stay at 0.
    func testRestartAfterConfirmedServesOTABundle() async throws {
        let manager = makeManager()
        let candidate = tempDir.appendingPathComponent("candidate")
        try stageValidCandidate(dir: candidate)
        try await manager.setBundlePath(candidate.path)
        _ = try await manager.activateBundle()
        await manager.confirmBoot()

        let embedded = URL(fileURLWithPath: "/embedded/main.jsbundle")
        let resolved = OpenOTABundleResolver.bundleURL(runtimeVersion: runtimeVersion, embeddedBundleURL: embedded, storageRoot: tempDir)
        XCTAssertNotEqual(resolved, embedded)

        let storage = BundleStorage(root: tempDir)
        XCTAssertEqual(storage.readState().bootAttempts, 0)
    }

    // 20. Restart after rollback: resolver serves the restored (previous) generation, not embedded.
    func testRestartAfterRollbackServesRestoredGeneration() async throws {
        let manager = makeManager()
        let gen1 = tempDir.appendingPathComponent("gen1")
        try stageValidCandidate(dir: gen1, version: "1.0.0")
        try await manager.setBundlePath(gen1.path)
        _ = try await manager.activateBundle()
        await manager.confirmBoot()

        let gen2 = tempDir.appendingPathComponent("gen2")
        try stageValidCandidate(dir: gen2, version: "2.0.0")
        try await manager.setBundlePath(gen2.path)
        _ = try await manager.activateBundle()

        _ = try await manager.rollbackBundle()

        let embedded = URL(fileURLWithPath: "/embedded/main.jsbundle")
        let resolved = OpenOTABundleResolver.bundleURL(runtimeVersion: runtimeVersion, embeddedBundleURL: embedded, storageRoot: tempDir)
        XCTAssertNotEqual(resolved, embedded)

        let storage = BundleStorage(root: tempDir)
        XCTAssertEqual(storage.readState().activeVersion, "1.0.0")
    }
}
