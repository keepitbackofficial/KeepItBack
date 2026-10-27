import type { Href, ImperativeRouter } from 'expo-router';

type BackRouter = Pick<ImperativeRouter, 'back' | 'canGoBack' | 'replace'>;

/** Go back when this route has history; deep links fall back to a useful screen. */
export function safeBack(router: BackRouter, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
