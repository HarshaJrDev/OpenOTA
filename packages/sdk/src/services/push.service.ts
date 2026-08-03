import { DeviceEventEmitter } from "react-native";

import { apiPost } from "../client.js";
import { getConfig } from "../config.js";
import { nativeBridge } from "../native/index.js";
import { otaStorage } from "../storage.js";
import type { Platform } from "../types.js";

const TOKEN_REFRESH_EVENT = "OpenOTA:pushTokenRefreshed";

/** Mirrors live.service.ts's resolveLiveEndpoint — push registration is a Cloud-only feature (a
 * device token has nowhere to live in the flat self-hosted namespace), so this is a no-op there. */
function resolveTokenEndpoint(projectId: string | undefined): string | null {
  return projectId ? `/projects/${projectId}/packages/fcm-token` : null;
}

let subscribed = false;

async function postToken(platform: Platform, fcmToken: string): Promise<void> {
  const config = getConfig();
  const endpoint = resolveTokenEndpoint(config.projectId);
  if (!endpoint) {
    return;
  }

  await apiPost(endpoint, {
    deviceId: otaStorage.getOrCreateDeviceId(),
    platform,
    channel: config.channel,
    fcmToken,
  });
}

/**
 * Registers this device for killed-app FCM delivery — complementary to live.service.ts's
 * WebSocket connection, not a replacement: that covers the app-open/backgrounded-but-alive case,
 * this covers the fully-killed case. No-op (resolves immediately, doesn't throw) if the native
 * runtime has no token to give (e.g. Firebase isn't configured on-device — see
 * docs/GETTING_STARTED.md's push-notification setup section) or there's no projectId configured.
 */
export async function registerPush(platform: Platform): Promise<void> {
  await nativeBridge.registerForPushNotifications();
  const token = await nativeBridge.getFcmToken();
  if (!token) {
    return;
  }
  await postToken(platform, token);

  if (!subscribed) {
    subscribed = true;
    DeviceEventEmitter.addListener(TOKEN_REFRESH_EVENT, (newToken: string) => {
      void postToken(platform, newToken);
    });
  }
}
