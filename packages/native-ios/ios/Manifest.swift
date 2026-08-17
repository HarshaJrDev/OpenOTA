import Foundation

let supportedManifestVersionV1 = 1
private let supportedManifestVersions: Set<Int> = [supportedManifestVersionV1]

/// The manifest shipped inside every OTA package (`manifest.json`), mirroring `BundleManifest` in
/// `Manifest.kt` field-for-field. `runtimeVersion`/`manifestVersion` are the forward-compatibility
/// hinges described there.
struct BundleManifest {
    let manifestVersion: Int
    let version: String
    let platform: String
    let runtimeVersion: String
    let sha256: String
    let size: Int64
    let createdAt: String
    let bundleName: String

    static func parse(_ data: Data) throws -> BundleManifest {
        let obj: [String: Any]
        do {
            guard let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw OpenOTAException.invalidManifest("Manifest is not a JSON object")
            }
            obj = parsed
        } catch let error as OpenOTAException {
            throw error
        } catch {
            throw OpenOTAException.invalidManifest("Manifest is not valid JSON")
        }

        let manifestVersion = (obj["manifestVersion"] as? Int) ?? supportedManifestVersionV1
        guard supportedManifestVersions.contains(manifestVersion) else {
            throw OpenOTAException.unsupportedManifestVersion(found: manifestVersion, supported: supportedManifestVersions)
        }

        func requireString(_ key: String) throws -> String {
            guard let value = obj[key] as? String, !value.isEmpty else {
                throw OpenOTAException.invalidManifest("Missing field \"\(key)\"")
            }
            return value
        }

        guard let sizeNumber = obj["size"] as? NSNumber else {
            throw OpenOTAException.invalidManifest("Missing field \"size\"")
        }

        return BundleManifest(
            manifestVersion: manifestVersion,
            version: try requireString("version"),
            platform: try requireString("platform"),
            runtimeVersion: try requireString("runtimeVersion"),
            sha256: try requireString("sha256"),
            size: sizeNumber.int64Value,
            createdAt: try requireString("createdAt"),
            bundleName: (obj["bundleName"] as? String) ?? "main.jsbundle"
        )
    }

    static func parse(contentsOf url: URL) throws -> BundleManifest {
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw OpenOTAException.invalidManifest("Manifest not found at \"\(url.path)\"")
        }
        return try parse(data)
    }
}

/// The runtime's own root-level state file (`OpenOTA/state.json`), distinct from the per-package
/// manifest above. Mirrors `RuntimeManifest` in `Manifest.kt`.
struct RuntimeManifest: Codable {
    var activeVersion: String?
    var activeBundlePath: String?
    var runtimeVersion: String?
    var manifestVersion: Int?
    var installTimeMillis: Int64?
    var state: RuntimeState
    var bootConfirmed: Bool
    var bootAttempts: Int

    static let empty = RuntimeManifest(
        activeVersion: nil,
        activeBundlePath: nil,
        runtimeVersion: nil,
        manifestVersion: nil,
        installTimeMillis: nil,
        state: .embedded,
        bootConfirmed: true,
        bootAttempts: 0
    )

    func toJSON() throws -> Data {
        try JSONEncoder().encode(self)
    }

    static func parse(_ data: Data) -> RuntimeManifest {
        (try? JSONDecoder().decode(RuntimeManifest.self, from: data)) ?? .empty
    }
}
