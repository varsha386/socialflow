# Developer setup

How to get SocialFlow running on your computer and work on it together through GitHub.

- **Who this is for:** the two SocialFlow developers, on Windows.
- **Setup:** we share **one Supabase project** (the same one the live site uses), and we work on **branches with pull requests**.

> ⚠️ **This repository is public.** Never commit `.env.local`, keys, passwords or tokens. They're already ignored by Git, so don't force-add them, and don't paste them into issues, pull requests or commit messages.

---

## Contents

1. [Owner: one-time setup for a new developer](#1-owner-one-time-setup-for-a-new-developer)
2. [New developer: set up your computer](#2-new-developer-set-up-your-computer)
3. [Run the app](#3-run-the-app)
4. [Daily workflow: branches and pull requests](#4-daily-workflow-branches-and-pull-requests)
5. [Rules for the shared database](#5-rules-for-the-shared-database)
6. [Before opening a pull request](#6-before-opening-a-pull-request)
7. [Where things are](#7-where-things-are)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Owner: one-time setup for a new developer

The repository owner (Varsha) does these steps once for each new developer.

| # | Where | What to do |
|---|---|---|
| 1 | **GitHub** → repository → **Settings → Collaborators → Add people** | Invite the developer's GitHub username. They accept the email invite. |
| 2 | **GitHub** → **Settings → Branches → Add branch ruleset** | Target `main`, then turn on **Require a pull request before merging** with **1 required approval**. This stops anyone (including you) from pushing straight to the live site. |
| 3 | **Send `.env.local` privately** | Send the file through a private chat or a password manager, **not** email or GitHub. It contains the secret key and the token encryption key, which must be identical for everyone. |
| 4 | **Google Cloud** → Google Auth Platform → **Audience → Test users** | Add the developer's Gmail, so they can connect a YouTube channel. |
| 5 | **Meta for Developers** → SocialFlow app → **App roles → Roles → Add people** | Add them as **Developer** (can see app settings) or **Tester** (can only log in). They accept at developers.facebook.com/requests. |
| 6 | **Supabase** → Organization → **Team → Invite** *(optional)* | Lets them open the dashboard and SQL Editor. Give **Developer** access. |
| 7 | **Inngest** → Settings → **Members** *(optional)* | Lets them see scheduled jobs on the live site. |

> Vercel's free (Hobby) plan has no team members. The live site still deploys automatically when pull requests are merged into `main`.

---

## 2. New developer: set up your computer

### 2.1 Install the tools

Open **PowerShell** and run each command:

```bash
winget install OpenJS.NodeJS.LTS
```

```bash
winget install Git.Git
```

```bash
winget install Microsoft.VisualStudioCode
```

**Close and reopen PowerShell**, then check they work:

```bash
node --version
```

```bash
git --version
```

Recommended VS Code extensions: **ESLint**, **Tailwind CSS IntelliSense**, **Prettier**.

### 2.2 Tell Git who you are

Use the email of your GitHub account (or GitHub's private `…@users.noreply.github.com` address from **Settings → Emails**):

```bash
git config --global user.name "Your Name"
```

```bash
git config --global user.email "you@example.com"
```

### 2.3 Get the code

Accept the GitHub collaborator invite first. Then create a `Development` folder on the **D: drive** (skip this if it already exists) and go into it:

```bash
New-Item -ItemType Directory -Force D:\Development
```

```bash
cd D:\Development
```

```bash
git clone https://github.com/varsha386/socialflow.git
```

```bash
cd socialflow
```

The first time you push, a GitHub sign-in window opens. Sign in and click **Authorize**.

> **No D: drive?** Use `C:\Development` instead in these steps. Any folder works, as long as the path has no spaces (for example `D:\Development\socialflow`, not `D:\My Projects\socialflow`). Some tools break on paths with spaces.

### 2.4 Add the settings file

Save the `.env.local` file you received from the owner in the project folder, next to `package.json`:

```
D:\Development\socialflow\.env.local
```

It should contain these settings (with real values). [.env.example](.env.example) lists them with explanations:

| Setting | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Connecting to the shared Supabase project |
| `SUPABASE_SECRET_KEY` | Server-only database access (publishing, analytics, inbox) |
| `TOKEN_ENCRYPTION_KEY` | Encrypting social media logins. **Must match the owner's exactly**, or connected accounts stop working |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | Connecting YouTube |
| `META_APP_ID`, `META_APP_SECRET` | Connecting Facebook and Instagram |
| `INNGEST_DEV=1` | Use the local scheduler instead of the live one |

Check Git ignores it. This command should print `.gitignore:...  .env.local`:

```bash
git check-ignore -v .env.local
```

### 2.5 Install the packages

```bash
npm install
```

This takes a few minutes the first time.

---

## 3. Run the app

Double-click **`start-dev.bat`** in the project folder, or run:

```bash
.\start-dev.bat
```

It opens two windows:

| Window | What it is | Address |
|---|---|---|
| **SocialFlow dev server** | The app | https://localhost:3000 |
| **SocialFlow scheduler (Inngest)** | Runs scheduled posts and background jobs on your computer | http://localhost:8288 |

The app runs on **https** because Threads and Meta only accept https login addresses. To avoid a browser warning, make a certificate once with [mkcert](https://github.com/FiloSottile/mkcert) (`winget install FiloSottile.mkcert`), from the project folder:

```bash
mkcert -install
```

```bash
mkdir certificates
```

```bash
mkcert -key-file certificates\localhost-key.pem -cert-file certificates\localhost.pem localhost 127.0.0.1 ::1
```

Without it, Next.js makes its own certificate. `.pem` files are never committed.

The first page load can take a minute while it compiles. After that, saving a file updates the browser automatically.

**To stop:** click each window, press **Ctrl + C**, type **Y**, then close it.

### Your first login

1. Open https://localhost:3000 and click **Sign up** with **your own email** (or **Continue with Google**).
2. In **Settings**, set your **time zone**.
3. In **Connections**, connect your own test accounts:
   - **Instagram:** must be a Business or Creator account, linked to a Facebook Page you manage.
   - **YouTube:** your Google account needs a channel.

Each person's posts and accounts are private to them, even though the database is shared.

---

## 4. Daily workflow: branches and pull requests

`main` is what's live: every merge into `main` deploys to https://socialflow-uhru.vercel.app. So nobody works on `main` directly.

### 4.1 Start a new piece of work

Get the latest `main`:

```bash
git switch main
```

```bash
git pull
```

Create a branch named after what you're doing. Use `feature/…` for new things and `fix/…` for bugs:

```bash
git switch -c feature/dark-mode
```

### 4.2 Save your work as you go

```bash
git add -A
```

```bash
git commit -m "Add dark mode toggle to Settings"
```

Write commit messages that say **what changed**, starting with a verb: "Add …", "Fix …", "Update …".

### 4.3 Share it and open a pull request

The first push of a new branch:

```bash
git push -u origin feature/dark-mode
```

After that, plain `git push` is enough.

Then on GitHub, click **Compare & pull request**:

- **Title:** what it does, for example "Add dark mode".
- **Description:** what changed, how you tested it, screenshots for screen changes, and any SQL migration that needs running (see section 5).
- **Reviewer:** the other developer.

Vercel adds a **preview link** to the pull request. Email and password login works there, but Google login and connecting accounts only work on `localhost` and the live site.

### 4.4 Review and merge

The reviewer:
1. Reads the changes on GitHub (**Files changed** tab), and leaves comments or **Approve**.
2. To try it locally, runs `git fetch` and then `git switch feature/dark-mode`, and starts the app.
3. Once approved, clicks **Squash and merge**, then **Delete branch**.

### 4.5 After a merge

Everyone updates their copy, and removes the old branch:

```bash
git switch main
```

```bash
git pull
```

```bash
git branch -d feature/dark-mode
```

If `package.json` changed, run `npm install` again.

### 4.6 If your branch falls behind `main`

Bring the latest `main` into your branch:

```bash
git fetch
```

```bash
git merge origin/main
```

If Git reports a **conflict**, VS Code highlights the clashing lines. Choose **Accept Current**, **Accept Incoming** or **Accept Both** for each one, save, and then:

```bash
git add -A
```

```bash
git commit
```

When unsure, ask the other developer before choosing.

### 4.7 Who works on what

- Agree on who does which feature before starting, so you don't edit the same files at the same time. The planned features are in the *SocialFlow Feature Roadmap* Word document, which the owner shares (it is not in this repository).
- Keep pull requests small (one feature or fix each). They're easier to review and less likely to conflict.

---

## 5. Rules for the shared database

We share one Supabase project, which is also the **live** database. So be careful.

1. **Never run SQL without telling the other developer.** A change to the database affects both of you, and the live site, immediately.
2. **Every database change is a migration file.** Add a new file to `supabase/migrations/`, named with the date and time (for example `20261020120000_saved_snippets.sql`), and mention it in the pull request.
3. **Run a migration only after its pull request is approved**, just before merging, in the Supabase **SQL Editor**. Check the address bar shows project **`elcquybhujocfdvindsq`**, and paste the **whole** file with nothing highlighted.
4. **Write migrations so they're safe to run twice**: `create table if not exists`, `add column if not exists`, `drop policy if exists` before `create policy`.
5. **Every new table needs** Row Level Security, an owner policy, and the "Require two-step login" policy (copy the pattern from `20261009100000_require_two_step_login.sql`).
6. ⛔ **Never re-run `20261007000000_initial_schema.sql`.** It deletes and recreates every table, which would **erase all posts and accounts**.
7. **Test with your own account only.** Don't edit or delete the other person's rows in the Table Editor.

### Background jobs while sharing a database

- **Scheduled posts made on your computer only publish if your scheduler window is open at that time.** The local scheduler keeps its jobs in memory, so closing it forgets them. Posts scheduled on the live site always publish.
- Both your local schedulers and the live site collect analytics and comments on a timer. That's harmless, but it uses a little more of the platforms' request limits.

---

## 6. Before opening a pull request

Run these in the project folder, and fix anything they report:

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

```bash
npm run build
```

Also check:

- [ ] Tested in the browser, including on a phone-sized window (F12, then the phone icon).
- [ ] Loading and error states look right.
- [ ] No keys, passwords or personal data in the code or screenshots.
- [ ] New settings are added to `.env.example` (with placeholder values) and sent to the other developer privately.
- [ ] New settings are added to **Vercel → Settings → Environment Variables** (owner) before merging.
- [ ] Any migration is mentioned in the pull request description.
- [ ] The README features table is updated if you added a feature.

---

## 7. Where things are

| Path | What's in it |
|---|---|
| `src/app/(app)/` | Logged-in pages: dashboard, create, bulk, calendar, posts, inbox, analytics, connections, settings |
| `src/app/(auth)/` | Log in, sign up, password reset, two-step code |
| `src/app/api/` | Connecting accounts, publish endpoint, Inngest endpoint |
| `src/components/` | Reusable screen pieces (composer, calendar, sidebar, UI kit in `ui/`) |
| `src/lib/connectors/` | Connecting Meta and YouTube accounts |
| `src/lib/publishing/` | Publishing to each platform |
| `src/lib/analytics/`, `src/lib/inbox/` | Collecting metrics and comments |
| `src/lib/post-rules.ts` | Each platform's limits and checks |
| `src/inngest/` | Background jobs (scheduled posts, analytics, comments) |
| `src/proxy.ts` | Page protection and two-step login checks |
| `supabase/migrations/` | Database changes, in order |
| `AGENTS.md` | Notes for AI coding assistants: this project uses **Next.js 16**, which differs from older versions |

The [README](README.md) explains the architecture and features.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `node` or `git` is "not recognized" | Close and reopen PowerShell (or VS Code) after installing. |
| `Port 3000 is in use` | Another copy is running. Close it, or run `Get-NetTCPConnection -LocalPort 3000 -State Listen \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` |
| Scheduler window shows errors, or port 8288 is in use | Close all scheduler windows, run `taskkill /IM inngest.exe /F`, then start again. |
| Changes to `.env.local` don't take effect | Stop the app and start it again. |
| "SocialFlow can't reach the login service" | `.env.local` is missing, in the wrong folder, or has a cut-off key. |
| Connected accounts say "Needs reconnecting" right after setup | Your `TOKEN_ENCRYPTION_KEY` differs from the owner's. Copy it exactly. |
| `relation "public.…" does not exist` in the SQL Editor | You're in the wrong Supabase project. Check the address bar shows `elcquybhujocfdvindsq`. |
| Facebook shows **"App not active"** | The Meta app is blocked or you're not in its App roles. Ask the owner to check the Meta dashboard. |
| Google says "Access blocked" when connecting YouTube | Your Gmail isn't in the Google test users list. Ask the owner to add it. |
| Scheduled post didn't publish locally | Your scheduler window was closed at that time, or your time zone in Settings is wrong. |
| Pages look broken after pulling | Run `npm install`, then restart the app. |
| Stuck with Git | Run `git status`. It usually says what to do next. Don't use `--force` without asking the other developer. |
