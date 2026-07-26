// jsdom/node's localStorage is unreliable under Node's experimental global
// (needs --localstorage-file). Install a simple in-memory implementation so
// component tests that touch window.localStorage behave like a browser.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i: number) { return [...this.store.keys()][i] ?? null; }
  get length() { return this.store.size; }
}

if (typeof window !== "undefined") {
  const ls = new MemoryStorage();
  Object.defineProperty(window, "localStorage", { value: ls, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true, writable: true });
  // matchMedia is referenced by theme/motion code paths under jsdom.
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
    })) as unknown as typeof window.matchMedia;
  }
}
