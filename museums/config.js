// config.js — Supabase project credentials for pubchat realtime channels.
//
// To wire up real multi-user chat:
//   1. Create a free Supabase project at https://supabase.com
//   2. In Project Settings → API, copy the Project URL + anon public key
//   3. Paste them below and commit.
//
// The anon key is PUBLIC by design — it only exposes Realtime Broadcast +
// Presence channels (which don't read or write any database tables). No SQL,
// no auth, no table enabling required.
//
// If these stay empty, pubchat runs in local-only preview mode: the UI renders
// and the bottom-sheet opens when you enter a hotspot, but you won't see or
// reach anyone else.

window.PUBCHAT_CONFIG = {
  SUPABASE_URL: 'https://tqnklodtiithbsxxyycp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxbmtsb2R0aWl0aGJzeHh5eWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDI3NDAsImV4cCI6MjA5MjE3ODc0MH0.ZGsxSsS_VbqBVqvW6q9AFFMBFoGzH5zRg9bSD5IAcsw'
};
