package com.openota.runtime

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * `BaseReactPackage` (not the legacy `ReactPackage`, and not the now-deprecated `TurboReactPackage`
 * it replaces) so the module registers correctly and lazily under both the old bridge and
 * bridgeless New Architecture without a second code path — autolinking picks this class up from
 * `react-native.config.js` without any manual `MainApplication` wiring beyond adding the package
 * to the list.
 */
class OpenOTAPackage : BaseReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == OpenOTAModule.NAME) OpenOTAModule(reactContext) else null

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            OpenOTAModule.NAME to ReactModuleInfo(
                OpenOTAModule.NAME,
                OpenOTAModule.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true, // isTurboModule
            ),
        )
    }
}
