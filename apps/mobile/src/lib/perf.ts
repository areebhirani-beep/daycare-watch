// Timing marks for the speed pass: "[perf] <name> <ms since JS start>" in the Metro log. Silent in release builds.
const start = Date.now();
let lastTap = 0;

export function mark(name: string): void {
  if (__DEV__ || process.env.EXPO_PUBLIC_PERF === '1') console.log(`[perf] ${name} ${Date.now() - start}ms`);
}

/** Call on a tap that navigates; `since()` then reports how long the next screen took to show content. */
export function tapped(name: string): void {
  lastTap = Date.now();
  mark(`tap ${name}`);
}

export function since(name: string): void {
  if (lastTap) mark(`${name} ${Date.now() - lastTap}ms after tap`);
  lastTap = 0;
}
