#import <React/RCTBridgeModule.h>

// Pure Objective-C (not Objective-C++) exported-method bridge for the Swift OpenOTA module
// (see OpenOTAModule.swift).
//
// Why this file exists: RCTModuleData discovers a module's exported methods by scanning its
// class hierarchy for class-level selectors whose name is prefixed "__rct_export__" (see
// react-native/React/Base/RCTModuleData.mm, -calculateMethods). Only the RCT_EXPORT_METHOD C
// macro emits those marker selectors — a Swift method annotated `@objc(selector:)` alone never
// does, no matter how it's declared, because there is no Swift-side equivalent of that macro.
// Without this file, OpenOTAModule.swift's methods were fully invisible to RN's method-export
// system even though the module itself resolved (TurboModuleRegistry.get("OpenOTA") returned a
// non-null object): Object.keys() on it was `[]` and every method read back as `undefined`,
// which JS then threw as "TypeError: undefined is not a function" the moment it called any of
// them (surfacing at the SDK layer as the generic "Failed to activate bundle" InstallError).
//
// This sidesteps the exact problem the Swift file's own header comment describes for the
// previously-attempted Objective-C++ trampoline: RCT_EXTERN_MODULE/RCT_EXTERN_METHOD declare
// selectors on a *stub* interface for the exported-method scanner to find; they don't need (and
// this file does not import) the compiler-generated "OpenOTA-Swift.h" header, so there's no
// dependency on Xcode's Swift-header-emission-before-ObjC++-compile ordering to get right. The
// real Swift class is found at runtime purely by matching @objc(OpenOTA)'s class name.
@interface RCT_EXTERN_MODULE(OpenOTA, NSObject)

RCT_EXTERN_METHOD(setBundlePath:(NSString *)path
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getBundlePath:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(activateBundle:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(rollback:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(restart:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearBundle:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getRuntimeInfo:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getFcmToken:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(registerForPushNotifications:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
