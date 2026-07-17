package com.openota.runtime

/** Base type for every error the runtime can raise; carries a stable [code] for the JS bridge. */
sealed class OpenOTAException(val code: String, message: String, cause: Throwable? = null) :
    Exception(message, cause)

class BundleManifestParseException(message: String, cause: Throwable? = null) :
    OpenOTAException("INVALID_MANIFEST", message, cause)

class UnsupportedManifestVersionException(found: Int, supported: Set<Int>) :
    OpenOTAException(
        "UNSUPPORTED_MANIFEST_VERSION",
        "Manifest version $found is not supported (supported: $supported)",
    )

class UnsupportedRuntimeVersionException(bundleRuntimeVersion: String, appRuntimeVersion: String) :
    OpenOTAException(
        "INVALID_RUNTIME",
        "Bundle runtimeVersion \"$bundleRuntimeVersion\" does not match app runtimeVersion \"$appRuntimeVersion\"",
    )

class BundleVerificationException(message: String, cause: Throwable? = null) :
    OpenOTAException("VERIFICATION_FAILED", message, cause)

class PathSecurityException(message: String) : OpenOTAException("PATH_SECURITY_ERROR", message)

class BundleInstallException(message: String, cause: Throwable? = null) :
    OpenOTAException("INSTALL_FAILED", message, cause)

class NoRollbackAvailableException : OpenOTAException("NO_ROLLBACK_AVAILABLE", "No rollback bundle is available")

class NotConfiguredException(message: String) : OpenOTAException("NOT_CONFIGURED", message)
