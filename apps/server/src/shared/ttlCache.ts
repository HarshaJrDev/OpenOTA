/**
 * Minimal in-process TTL cache — no Redis, no extra infra. Correct for exactly one Render dyno
 * (the current deployment reality documented in env.ts/app.ts); if this ever runs as more than
 * one instance, each instance just has its own cache, which is safe (never serves stale data
 * across instances, only slightly less effective) but not shared. Revisit with a real cache layer
 * only if/when horizontal scaling actually happens.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Invalidates every entry for a given prefix — used when a release/rollback changes what "active" means. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}
