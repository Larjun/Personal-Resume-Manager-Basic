# Resume Builder — Stage Prompts (1.5 → 2)

Paste-ready prompts for Claude Code, one per stage. Save this file in your repo as `docs/stage-prompts.md` so it stays with the project.

## How to use these

- **One stage per Claude Code session.** Run `/clear` before starting a new stage so old context doesn't carry over. CLAUDE.md holds what each stage needs to know about the project.
- **Start in plan mode** (Shift+Tab). Read the plan before approving it, especially the data model changes.
- **Commit after each milestone.** Every prompt tells Claude Code to stop after each one so you can test.
- **Each stage ends by updating CLAUDE.md**, so the next stage starts with an accurate picture.
- Each stage has a **"You check"** list. Go through it yourself before moving on.

**Repo facts these prompts assume** (CLAUDE.md has the details):
- Postgres on **Supabase**, accessed through Drizzle (postgres-js). Supabase Auth owns users (`auth.users`); Drizzle manages only the `public` schema.
- Data access: reads in `src/server/<area>.ts` (not "use server"), mutations in `src/server/actions*.ts` ("use server", zod-validated). Pages never query tables directly.
- Every user-data table follows the `resumes` pattern: `user_id` FK to `auth.users` with cascade delete, an index on it, and `.enableRLS()` with no policies. The server connects as `postgres` (bypasses RLS), so every query filters by the current user's id.
- Resume content is one jsonb document (`resumes.content`) validated by `src/lib/resume/schema.ts`. Changing its shape means bumping `CONTENT_VERSION` and adding a step in `src/lib/resume/migrate.ts`.

| Stage | What |
|---|---|
| 1.5 | Auth (Supabase: email + Google), account settings |
| 2 | Master library (items, bullet pool, variants, tags) |

---

## Stage 1.5 — Auth, account settings, Postgres

```text
Read CLAUDE.md first. Stage 1 (local resume editor) is done. This is Stage 1.5: add
real user accounts so every later stage is built per user from the start.

Decisions already made:
- Stay on Supabase Postgres with Drizzle (already set up). Schema and migrations
  stay in drizzle-kit, limited to the public schema.
- Auth: Supabase Auth through @supabase/ssr. Two sign-in methods: email + password,
  and Google OAuth (Supabase's Google provider; the client ID/secret live in the
  Supabase dashboard, not in .env.local). A Google account and an email account
  with the same verified address are the same user (Supabase links them).
  Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and
  SUPABASE_SERVICE_ROLE_KEY (server only; used only by the seed script and
  account deletion, imported only from "server-only" modules).
- Email: Resend set up as custom SMTP in the Supabase dashboard. Supabase sends
  the verification, reset, and email-change emails (our server never sees the links).
- Rate limits: Supabase Auth's built-in limits (dashboard → Auth → Rate Limits).

Milestones (stop after each so I can test and commit):

1.5a — Auth foundation and per-user data
  - resumes.user_id becomes NOT NULL with a foreign key to auth.users (authUsers
    from drizzle-orm/supabase), on delete cascade, plus an index. Existing rows
    have a null user_id, so: migration with the FK + index → seed claims orphan
    rows → migration that sets NOT NULL.
  - New profiles table (id = auth.users.id, cascade; display_name; timestamps;
    RLS on, no policies). Rows are created lazily with an upsert.
  - src/proxy.ts (Next 16's name for middleware) refreshes the session cookie and
    redirects signed-out users to /login. That is an optimistic check only. The
    real gate is requireUser() in src/server/auth.ts, called by every read
    function, server action, and route handler. It refuses unverified emails.
  - Every query for user data filters by the current user's id, in
    src/server/resumes.ts and src/server/actions.ts. Pages never query tables
    directly. Another user's resume id returns null, so the page 404s.
  - Seed script creates or finds a confirmed dev user (SEED_USER_EMAIL /
    SEED_USER_PASSWORD) via the admin API and assigns the seed resume to them.

1.5b — Auth flows
  - Sign up (email verification required before first use), log in, log out,
    forgot password, reset password via emailed link.
  - Email links point to /auth/confirm?token_hash=...&type=..., which calls
    verifyOtp. Tokens expire and are single-use (Supabase's built-in behavior).
    List the email template changes I need to make in the dashboard.
  - "Forgot password" must respond the same whether or not the email exists.
  - "Continue with Google" on the login and sign-up pages: signInWithOAuth with
    redirectTo /auth/callback, which calls exchangeCodeForSession and redirects to
    a validated same-origin "next" path (never an open redirect). Google accounts
    count as verified. OAuth errors or a cancelled consent screen go back to
    /login with a readable message.
  - Clean, simple pages that match the app's existing style.

1.5c — Account settings page
  - Change display name (profiles; prefill from Google's name on first sign-in),
    change password (check the current password first), change email (secure
    email change: confirm the new address), delete account (confirm by typing the
    email; admin deleteUser, and cascades remove all of the user's data).
  - Show which sign-in methods the account has (email/password, Google). A
    Google-only account sees "Set a password" instead of "Change password": it
    uses Supabase's reauthenticate() (emailed code) + updateUser({ password, nonce }).
  - "Connect Google" (linkIdentity) for email accounts and "Disconnect" (unlinkIdentity),
    which is refused when it would leave the account with no way to sign in.
  - Keep account details separate from resume contact info. The name, phone, and
    links printed on a resume are resume data, not account data.

Rules:
- Never log passwords or tokens. All secrets come from .env.local; add the new
  vars to .env.example with placeholder values.
- At the end, update CLAUDE.md: auth stack, the requireUser() + "every query
  filters by user_id" rule, profiles, migration/seed order, env vars, and a
  checklist of the Supabase dashboard settings.
```

**You check:**
- Two accounts in two browsers (one normal window, one private) can't see each other's resumes, including by pasting a resume URL from the other account.
- An account that hasn't verified its email can't use the app.
- Sign up with email, then "Continue with Google" with the same Gmail address: you land in the same account with the same resumes.
- A Google-only account can set a password and then log in with it.
- Reset link works once, then fails. An expired link fails.
- "Forgot password" with an unknown email shows the same message as with a real one.
- Deleting an account removes its resumes and profile from the database (check in Drizzle Studio or the Supabase table editor).

---

## Stage 2 — Master library

```text
Read CLAUDE.md first. This is Stage 2: a master library of everything the user has
done (experiences, projects, education, skill groups, summaries). Resumes are built by
picking items from the library.

Data model (every table follows the resumes pattern: user_id FK to auth.users with
cascade, index, RLS on with no policies; every query goes through src/server/ and
filters by user id):
- LibraryItem: id, userId, kind (experience | project | publication | education |
  skills | summary), fields (zod-validated; shape depends on kind and reuses the
  content schemas in src/lib/resume/schema.ts: experience and project both map to
  the "entries" section type's EntrySchema, publication to PaperSchema, etc.),
  tags[], createdAt, updatedAt.
- LibraryBullet: id, itemId, order, tags[]. A bullet has one or more variants.
- BulletVariant: id, bulletId, text, label (optional, e.g. "short", "detailed"),
  createdAt.
- A library item holds MORE bullets than any single resume uses. Resumes pick a subset.

Resumes stay self-contained copies (a resume that has been sent must never change by
itself). Resume entries and bullets live inside the resumes.content jsonb, not in
tables, so source tracking goes on the content zod schemas (EntrySchema, PaperSchema,
SchoolSchema, SkillRowSchema, BulletSchema, summary section as needed). Bump
CONTENT_VERSION and add a step in src/lib/resume/migrate.ts that fills the new fields
with null:
- entry: sourceItemId (nullable), sourceItemUpdatedAt (nullable; when it was copied)
- bullet: sourceBulletId (nullable), sourceVariantId (nullable), text (the copy)
- cloneWithNewIds (Duplicate) keeps the source fields; only our own ids change.

Milestones (stop after each):

2a — Library page
  - Tabs by kind, text search, filter by tags.
  - Create/edit/delete items. Edit the bullet pool: add, reorder (dnd-kit), delete
    bullets; add and label variants per bullet.
  - Show "Used in N resumes" on each item.

2b — "Add from library" drawer in the resume editor
  - Filter by kind or tag, check items to add.
  - Expand an item to choose which bullets, and which variant of each.
  - Adding copies the content into the right section of the resume, with source ids set.

2c — Sync between library and resumes
  - If the library item changed after it was copied (updatedAt > sourceItemUpdatedAt),
    show a "Library updated" badge on the resume entry, with "Pull latest" that shows
    a text diff (use the `diff` package) before applying.
  - If the user edits a copied bullet in a resume, offer "Save to library as new
    variant" or "Keep in this resume only".
  - If the source item is deleted, the resume keeps its copy and shows "source deleted".

2d — Import + tags
  - "Import into library" on an existing resume: create library items from its
    entries, then link the resume's entries to them (set source ids). Run it on the
    seed resume.
  - Tag input with autocomplete from the user's existing tags.
  - A tag alias map in code (src/lib/tags.ts, with vitest tests), e.g. ts → TypeScript, js → JavaScript,
    postgres → PostgreSQL, k8s → Kubernetes. Normalize every tag before saving.

At the end, update CLAUDE.md with the library model and the copy-with-sync rule.
```

**You check:**
- Edit a library bullet. The resume shows "Library updated", and the diff is correct.
- A resume entry with "Keep in this resume only" edits doesn't change the library.
- Importing the seed resume twice doesn't create duplicates, or at least warns you.
