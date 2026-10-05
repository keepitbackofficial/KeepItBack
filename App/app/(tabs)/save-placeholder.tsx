import { Redirect } from 'expo-router';

/** Hidden tab backing the center + button; navigates to the Save modal. */
export default function SavePlaceholder() {
  return <Redirect href="/save" />;
}
