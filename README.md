# SocialFlow

**Write once. Post everywhere.** SocialFlow is a web app for creating, scheduling and publishing posts to several social media platforms from one dashboard.

> Learning and portfolio project, under active development.

## Features

| Feature | Status |
|---|---|
| Sign up, log in, Google login, password reset | ✅ Done |
| Protected app pages with a sidebar layout | ✅ Done |
| Connect Bluesky, LinkedIn, YouTube, Facebook and Instagram | 🚧 Planned |
| Create a post with media, per-platform captions and a preview | 🚧 Planned |
| Publish now or schedule for later | 🚧 Planned |
| Calendar, bulk upload, analytics and inbox | 🚧 Planned |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) with TypeScript
- [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com) for auth, the Postgres database and file storage
- [Vercel](https://vercel.com) for hosting

## Running it locally

1. Install [Node.js](https://nodejs.org) (LTS).
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key.
3. On Windows, double-click `start-dev.bat`. On any system, you can also run:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000.

## Project structure

```
src/
  app/
    (app)/        Logged-in pages: dashboard, create, calendar, and so on
    (auth)/       Log in, sign up, forgot and reset password
    auth/callback Where email links and Google login return to
  components/     Reusable UI pieces
  lib/            Supabase clients, auth functions, platform list
  proxy.ts        Keeps the session fresh and protects pages
```
