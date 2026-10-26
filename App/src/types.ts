/**
 * KeepItBack domain types — mirrors the Supabase schema in
 * supabase/migrations/. Column names match the database exactly.
 */

export type Platform =
  | 'Instagram'
  | 'YouTube'
  | 'TikTok'
  | 'Facebook'
  | 'X'
  | 'Pinterest'
  | 'Reddit'
  | 'Web';

export type ContentType =
  | 'Reel'
  | 'Short'
  | 'Video'
  | 'Post'
  | 'Carousel'
  | 'Image'
  | 'Article'
  | 'Link';

/** Where a saved item came from. */
export type SaveSource = 'manual' | 'share_extension' | 'instagram_dm' | 'account_import';

export interface SavedItem {
  id: string;
  user_id: string;
  original_url: string;
  canonical_url: string;
  platform: Platform;
  content_type: ContentType;
  title: string;
  creator_name?: string | null;
  creator_handle?: string | null;
  source: SaveSource;
  note?: string | null;
  saved_at: string;
  opened_at?: string | null;
  open_count: number;
  is_archived: boolean;
  fts?: unknown;
  tags?: string[];
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  description?: string | null;
  created_at: string;
  item_count?: number;
}

export interface Profile {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  created_at: string;
}

export type ConnectedProvider = 'instagram';

export interface ConnectedAccount {
  id: string;
  user_id: string;
  provider: ConnectedProvider;
  provider_account_id: string;
  provider_username?: string | null;
  linked_at: string;
}

/** Platform group filter used in Search/Library (PRD v2 §4). */
export const PLATFORM_FILTERS = ['All', 'Instagram', 'TikTok', 'YouTube', 'Web'] as const;
export type PlatformFilter = (typeof PLATFORM_FILTERS)[number];
