import { getShareExtensionKey } from 'expo-share-intent';

/**
 * Route native share-extension deep links into the app at home. The global
 * ShareIntentBridge (root layout) reads the share payload and decides where
 * to go — this keeps the flow working on Android, where an ACTION_SEND share
 * never produces a deep-link path at all.
 */
export function redirectSystemPath({ path }: { path: string; initial: string }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
