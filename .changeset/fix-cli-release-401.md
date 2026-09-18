---
"@openota/cli": patch
---

Fix `openota doctor` reporting "Authentication: logged in" for a stale, revoked, or server-rotated API key on self-hosted (non-project) servers, which then caused `openota release`/`upload`/`rollback` to fail with an unhelpful `Request failed with status code 401` mid-upload.

- `doctor`'s Authentication check now actually validates the stored key against the server (same request `openota login` already made), instead of only checking that a key is present locally.
- `release`, `upload`, and `rollback` now produce actionable error messages ("Authentication failed: the API key was rejected... run `openota login --api-key <key>` to re-authenticate") instead of the raw axios error text.
- Fixed a stuck spinner: a failed upload used to leave `Uploading android package (100%)...` running forever instead of failing and stopping.
