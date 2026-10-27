import { getSupabase } from '../lib/supabase';

export type ProductEvent = 'account_created' | 'content_saved' | 'content_opened' | 'search_performed' | 'filter_used' | 'collection_created' | 'tag_added' | 'download_started' | 'download_completed' | 'download_deleted' | 'item_deleted' | 'share_extension_used';

/** Opt-in first-party event logging. Rows contain only a fixed event name and timestamp. */
export async function logProductEvent(userId: string, eventName: ProductEvent) {
  try {
    const db = getSupabase();
    const { data } = await db.from('profiles').select('analytics_opt_in').eq('user_id', userId).maybeSingle();
    if (!data?.analytics_opt_in) return;
    await db.from('analytics_events').insert({ user_id: userId, event_name: eventName });
  } catch {
    // Product analytics never block the user action.
  }
}
