# SOYBREACH — Supabase working version

This version connects SOYBREACH to Supabase instead of browser `localStorage`.

## What works

- Real Supabase email/password accounts
- User profiles
- Public posts shared between visitors/devices
- Required tags
- Tag search
- Comments
- Optional image uploads through Supabase Storage
- Text downloads
- Users can delete their own posts

## Setup

1. The Supabase project URL and publishable key are already configured in `app.js`.
2. In Supabase SQL Editor, run `SUPABASE_SETUP.sql` once. It creates the profile-on-registration trigger and the `post-images` storage bucket/policies.
3. In Supabase Authentication settings, keep Email enabled. If email confirmation is enabled, new users must confirm their email before logging in.
4. Upload all files in this folder to the root of your GitHub Pages repository, replacing the old SOYBREACH files.
5. Open the GitHub Pages site and create an account.

## Security

The browser contains only the Supabase publishable key. The database is protected by Row Level Security (RLS), which must remain enabled.

Do NOT put a Supabase secret key, service-role key, or database password in the website.

## Important

This is the first real backend version. Admin accounts, bans, moderation, and 30-day trash are intentionally NOT included yet. We will add those before the public launch.

The optional image bucket is public so post images can be displayed to visitors. Users can only upload/delete files inside their own user folder.

