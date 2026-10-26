import { getShareExtensionKey } from 'expo-share-intent';

/** Route native share-extension callbacks to the screen that consumes the payload. */
export function redirectSystemPath({ path }: { path: string; initial: string }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return '/shareintent';
    }
    return path;
  } catch {
    return '/';
  }
}
