/** Core domain types — mirrors the PRD §25 data architecture. */

export type Platform =
  | 'Instagram'
  | 'YouTube'
  | 'TikTok'
  | 'Facebook'
  | 'X'
  | 'Pinterest'
  | 'Reddit'
  | 'Other';

export type ContentType =
  | 'Reel'
  | 'Short'
  | 'Video'
  | 'Post'
  | 'Image'
  | 'Carousel'
  | 'Article'
  | 'Link';

export const CATEGORIES = [
  'Travel',
  'Food',
  'Education',
  'Technology',
  'Programming',
  'Fitness',
  'Finance',
  'Shopping',
  'Business',
  'Entertainment',
  'Inspiration',
  'Lifestyle',
  'News',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface SavedItem {
  id: string;
  originalUrl: string;
  platform: Platform;
  contentType: ContentType;
  title: string;
  creatorName: string;
  creatorHandle?: string;
  emoji: string;
  savedAt: number;
  openedAt?: number;
  openCount: number;
  isArchived: boolean;
  /** Local download state */
  downloadState: 'none' | 'downloading' | 'downloaded' | 'unsupported';
  downloadProgress: number; // 0..1
  downloadSizeMb?: number;
  /** User organization */
  tags: string[];
  note?: string;
  whySaved?: string;
  /** AI metadata (phase 1) */
  aiState: 'pending' | 'done' | 'failed';
  aiSummary?: string;
  aiKeywords: string[];
  aiCategory?: Category;
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  isPrivate: boolean;
  createdAt: number;
  itemIds: string[];
}

export interface Profile {
  displayName: string;
  username: string;
  email: string;
  bio?: string;
}

export interface Settings {
  privateProfile: boolean;
  publicCollections: boolean;
  aiProcessing: boolean;
  analyticsConsent: boolean;
  allowDuplicateSaves: boolean;
  notifDownload: boolean;
  notifAi: boolean;
  notifCollections: boolean;
  notifAnnouncements: boolean;
}
