import { DeviceEventEmitter, Platform } from "react-native";

import { apiPost } from "../client.js";
import { getConfig } from "../config.js";
import { nativeBridge } from "../native/index.js";
import { otaStorage } from "../storage.js";

// Must match the native side's event name exactly — see
// packages/native-android/.../push/OpenOTAFirebaseMessagingService.kt's TOKEN_REFRESH_EVENT.
const TOKEN_REFRESH_EVENT = "OpenOTA:pushTokenRefreshed";

function currentPlatform(): "android" | "ios" {
  return Platform.OS === "android" ? "android" : "ios";
}

// Module-level guard so calling OTA.registerPush() more than once (e.g. from a re-mounted root
// component) subscribes to the native token-refresh event only once — same "no-op if already
// done" idempotency OTA.connectLive() already has.
let tokenRefreshSubscribed = false;

async function postToken(token: string): Promise<void> {
  const projectId = getConfig().projectId;
  // Self-hosted/flat-route servers have no project concept and no fcm-token endpoint to hit —
  // same "silently skip, don't throw" posture reportInstallResult already has for that case.
  if (!projectId) {
    return;
  }

  await apiPost(`/projects/${projectId}/packages/fcm-token`, {
    deviceId: otaStorage.getOrCreateDeviceId(),
    platform: currentPlatform(),
    channel: getConfig().channel,
    fcmToken: token,
  }).catch(() => undefined);
}

/**
 * Requests the notification permission (Android 13+; no-ops elsewhere), reads the current FCM
 * token and posts it to the server, then subscribes to future token-refresh events so a rotated
 * token is always kept current server-side. Deliberately does NOT handle foreground FCM messages
 * here — while the app is alive, OTA.connectLive()'s WebSocket is the live path, and a foreground
 * data message arriving in that state is simply inert; handling it too would mean the app reacts
 * twice to the same release event.
 */
export async function registerPush(): Promise<void> {
  await nativeBridge.registerForPushNotifications().catch(() => undefined);

  const token = await nativeBridge.getFcmToken().catch(() => null);
  if (token) {
    await postToken(token);
  }

  if (!tokenRefreshSubscribed) {
    tokenRefreshSubscribed = true;
    DeviceEventEmitter.addListener(TOKEN_REFRESH_EVENT, (newToken: string) => {
      void postToken(newToken);
    });
  }
}
