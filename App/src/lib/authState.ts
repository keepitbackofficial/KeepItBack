import type { User } from '@supabase/supabase-js';

let activeUser: User | null = null;

/** Keeps the active Supabase user available to non-React data modules. */
export function setActiveUser(user: User | null) {
  activeUser = user;
}

export function getActiveUser() {
  return activeUser;
}

export function getActiveUserId() {
  return activeUser?.id ?? null;
}
