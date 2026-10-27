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
  description?: string | null;
  thumbnail_url?: string | null;
  creator_name?: string | null;
  creator_handle?: string | null;
  category?: string | null;
  source: SaveSource;
  note?: string | null;
  saved_at: string;
  opened_at?: string | null;
  open_count: number;
  is_archived: boolean;
  fts?: unknown;
  tags?: string[];
  sync_state?: 'synced' | 'pending' | 'syncing' | 'error';
  local_downloaded?: boolean;
  /** Device-only alias used to keep an offline detail route stable after sync. */
  remote_id?: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  description?: string | null;
  created_at: string;
  item_count?: number;
  role?: 'owner' | 'editor' | 'viewer';
  is_shared?: boolean;
}

export interface CollectionMember {
  collection_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: string;
}

export interface LocalDownload {
  item_id: string;
  user_id: string;
  local_uri: string;
  media_type: string;
  file_size: number;
  downloaded_at: string;
}

export interface NotificationPreferences {
  download_complete: boolean;
  sync_issues: boolean;
  shared_collection_updates: boolean;
}

export interface SearchFilters {
  platform?: PlatformFilter;
  contentType?: ContentType | 'All';
  category?: string | 'All';
  dateFrom?: string;
  dateTo?: string;
  downloadedOnly?: boolean;
}

export interface Profile {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  created_at: string;
  analytics_opt_in?: boolean;
  notification_preferences?: NotificationPreferences;
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
export const PLATFORM_FILTERS = ['All', 'Instagram', 'TikTok', 'YouTube', 'Facebook', 'X', 'Pinterest', 'Reddit', 'Web'] as const;
export type PlatformFilter = (typeof PLATFORM_FILTERS)[number];

export const CONTENT_TYPE_FILTERS = ['All', 'Video', 'Reel', 'Short', 'Post', 'Image', 'Carousel', 'Article', 'Link'] as const;
export const DEFAULT_CATEGORIES = [
  'Travel', 'Food', 'Education', 'Technology', 'Programming', 'Fitness', 'Finance',
  'Shopping', 'Business', 'Entertainment', 'Inspiration', 'Lifestyle', 'News', 'Other',
] as const;
