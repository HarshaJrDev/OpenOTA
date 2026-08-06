---
"@openota/sdk": minor
---

Publish `OTA.connectLive()` / `OTA.disconnectLive()` — real-time release/rollback notifications over
a WebSocket connection, added in b82f76d but never previously released. A device that calls
`connectLive()` is notified the instant a release, rollback, or rollout-percentage change happens
on its channel, instead of only finding out on the next `check()`/`sync()` call or app resume.

This was source-complete in the monorepo but missing from every published `0.2.x` release —
confirmed by inspecting the published tarball directly, not just local build output.
