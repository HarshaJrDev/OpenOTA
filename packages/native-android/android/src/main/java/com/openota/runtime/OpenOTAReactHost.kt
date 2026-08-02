package com.openota.runtime

import android.content.Context
import com.facebook.react.ReactHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactPackageTurboModuleManagerDelegate
import com.facebook.react.bridge.JSBundleLoader
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.common.build.ReactBuildConfig
import com.facebook.react.defaults.DefaultComponentsRegistry
import com.facebook.react.defaults.DefaultTurboModuleManagerDelegate
import com.facebook.react.fabric.ComponentFactory
import com.facebook.react.runtime.BindingsInstaller
import com.facebook.react.runtime.JSRuntimeFactory
import com.facebook.react.runtime.ReactHostDelegate
import com.facebook.react.runtime.ReactHostImpl
import com.facebook.react.runtime.hermes.HermesInstance

/**
 * [ReactHostDelegate] whose [jsBundleLoader] is resolved fresh on every access instead of once at
 * construction. `getDefaultReactHost`'s `DefaultReactHostDelegate` captures `jsBundleFilePath` as
 * a fixed constructor value, so [ReactHost.reload] — the only supported "swap the running bundle"
 * path in bridgeless mode — keeps replaying whichever bundle was resolved when the host app's
 * process started. That silently defeats OTA activation: the first bundle a process ever loads
 * (embedded, on a cold start with no active OTA bundle yet) is permanent for that process's
 * lifetime, no matter how many bundles get activated afterwards. Making [jsBundleLoader] a getter
 * backed by [BundleLoader] makes every reload re-check "what's the currently active OpenOTA
 * bundle" instead of reusing a stale answer computed before this activation happened.
 */
/**
 * The actual "what should React Native load right now" decision, isolated from
 * [DynamicBundleReactHostDelegate]'s other [ReactHostDelegate] plumbing so it can be exercised in
 * plain JVM unit tests: [JSRuntimeFactory] (a required field on that delegate) triggers a native
 * `SoLoader` load merely by being class-loaded, which no JVM-only test can satisfy.
 */
internal object ActiveBundleLoaderResolver {
    fun resolve(context: Context, runtimeVersion: String, jsBundleAssetPath: String): JSBundleLoader {
        val activeBundlePath = BundleLoader.getJSBundleFile(context, runtimeVersion)
        return if (activeBundlePath != null) {
            JSBundleLoader.createFileLoader(activeBundlePath)
        } else {
            JSBundleLoader.createAssetLoader(context, "assets://$jsBundleAssetPath", true)
        }
    }
}

@OptIn(UnstableReactNativeAPI::class)
internal class DynamicBundleReactHostDelegate(
    override val jsMainModulePath: String,
    private val context: Context,
    private val runtimeVersion: String,
    private val jsBundleAssetPath: String,
    override val reactPackages: List<ReactPackage>,
    override val jsRuntimeFactory: JSRuntimeFactory,
    override val bindingsInstaller: BindingsInstaller?,
    override val turboModuleManagerDelegateBuilder: ReactPackageTurboModuleManagerDelegate.Builder,
    private val exceptionHandler: (Exception) -> Unit,
) : ReactHostDelegate {

    override val jsBundleLoader: JSBundleLoader
        get() = ActiveBundleLoaderResolver.resolve(context, runtimeVersion, jsBundleAssetPath)

    override fun handleInstanceException(error: Exception): Unit = exceptionHandler(error)
}

/**
 * Bridgeless-mode `ReactHost` factory for OpenOTA host apps. This is a drop-in replacement for
 * `getDefaultReactHost(..., jsBundleFilePath = BundleLoader.getJSBundleFile(...))`: use it in
 * `MainApplication.kt`'s `reactHost` override instead of calling `getDefaultReactHost` directly,
 * so that [RestartManager]'s `reload()` after an OTA activation actually serves the newly
 * activated bundle rather than replaying whatever was active at process start.
 */
object OpenOTAReactHost {

    @OptIn(UnstableReactNativeAPI::class)
    fun create(
        context: Context,
        packageList: List<ReactPackage>,
        runtimeVersion: String,
        jsMainModulePath: String = "index",
        jsBundleAssetPath: String = "index.android.bundle",
        useDevSupport: Boolean = ReactBuildConfig.DEBUG,
        exceptionHandler: (Exception) -> Unit = { throw it },
    ): ReactHost {
        // Seed BundleManager's singleton with the correct runtimeVersion right now, eagerly —
        // not lazily via jsBundleLoader's getter below. In dev builds (useDevSupport = true),
        // Metro serves the initial JS bundle directly and jsBundleLoader is never consulted on
        // cold boot, so without this call OpenOTAModule's own lazy BundleManager.getInstance()
        // (no runtimeVersion) would win the race the first time JS calls a native OpenOTA method
        // — silently falling back to the APK's versionName and rejecting every real OTA bundle
        // with a bogus runtimeVersion mismatch. Deliberately BundleManager.getInstance(), not
        // BundleLoader.getJSBundleFile() — the latter also calls recordBootAttempt(), and this
        // must not double-count a boot attempt when jsBundleLoader's getter runs its own
        // (legitimate, single) call to that same method right after.
        BundleManager.getInstance(context.applicationContext, runtimeVersion)

        val turboModuleManagerDelegateBuilder = DefaultTurboModuleManagerDelegate.Builder()

        val delegate =
            DynamicBundleReactHostDelegate(
                jsMainModulePath = jsMainModulePath,
                context = context.applicationContext,
                runtimeVersion = runtimeVersion,
                jsBundleAssetPath = jsBundleAssetPath,
                reactPackages = packageList,
                jsRuntimeFactory = HermesInstance(),
                bindingsInstaller = null,
                turboModuleManagerDelegateBuilder = turboModuleManagerDelegateBuilder,
                exceptionHandler = exceptionHandler,
            )

        val componentFactory = ComponentFactory()
        DefaultComponentsRegistry.register(componentFactory)

        return ReactHostImpl(
            context.applicationContext,
            delegate,
            componentFactory,
            /* allowPackagerServerAccess = */ true,
            useDevSupport,
        )
    }
}
