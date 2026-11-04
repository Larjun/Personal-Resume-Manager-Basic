# Personal Resume Manager (Basic)

A free, self-hosted resume builder. You edit structured content on the left and get a live, paginated, print-accurate preview on the right. Export through the browser's "Save as PDF". The print view matches the preview page for page, and text stays selectable.

## Features

- **Resumes:** create, rename, duplicate and delete them. Each resume can be A4 or Letter.
- **Structured editor:** header, summary, experience, projects, publications, education and skills sections. Drag to reorder sections, entries, bullets and contacts. Rename section headings. An include checkbox hides an item from the resume without deleting it. Changes save automatically.
- **Pagination:** blocks are measured and laid out on fixed-size pages without being split. The preview shows page numbers and the page count.
- **Master library:** write each job, project, publication, school and skill group once, with a pool of bullets and alternative wordings. Copy items into any resume. "Library updated" / "Pull latest" brings in library changes, and "Update library" sends a bullet you edited in a resume back to the library.
- **Tags:** tag library items and bullets, with autocomplete and an alias map (`ts` becomes TypeScript, `k8s` becomes Kubernetes, and so on).
- **Accounts:** email and password sign-up, or Google sign-in. Account settings for name, email, password, linking Google, and deleting the account.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase (Postgres and Auth), Drizzle ORM, zod, dnd-kit, vitest.

## Requirements

- Node.js 20.9 or newer
- A [Supabase](https://supabase.com) project (the free tier is enough)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:migrate           # create the tables in your Supabase database
npm run dev                  # http://localhost:3000
```

### Environment variables

Put these in `.env.local` (git ignores it). `.env.example` lists them all.

| Variable | Where to find it | Used by |
| --- | --- | --- |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string. Use the **pooler** URL (session pooler on port 5432, or transaction pooler on 6543). | App, migrations, scripts |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL (`https://<project-ref>.supabase.co`) | App, seed script |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API keys → publishable key (`sb_publishable_...`) | App |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API keys → service role / secret key. **Server only:** never prefix it with `NEXT_PUBLIC_` or commit it. | Account deletion, seed script |
| `SEED_USER_EMAIL` | Any email you choose | Seed script only (optional) |
| `SEED_USER_PASSWORD` | Any password you choose (8+ characters) | Seed script only (optional) |

### Supabase dashboard settings

These live in the Supabase dashboard, not in code. Set them in **Authentication** for every environment, and change `localhost:3000` to your real domain in production.

- **URL Configuration:** Site URL `http://localhost:3000`. Redirect URLs: `http://localhost:3000/**`.
- **Providers → Email:** turn on Confirm email and Secure email change. Set the minimum password length to 8.
- **Emails → Templates:** the links must point to `/auth/confirm` with a token hash, so that they work in any browser:
  - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`
  - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
  - Change email address: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/account`
  - Reauthentication: keep `{{ .Token }}` in it. It sends the 6-digit code used by "Set a password".
- **Emails → SMTP (recommended):** Supabase's built-in sender only delivers to members of your Supabase team and is heavily rate-limited. To let other people sign up, add an SMTP provider such as [Resend](https://resend.com) (`smtp.resend.com`, port 465, user `resend`, password = your Resend API key, sender on a domain you've verified there).
- **Providers → Google (optional):** to offer Google sign-in, create an OAuth client in Google Cloud Console with the authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, and enter its client ID and secret here. Also turn on **Allow manual linking** so that "Connect Google" on the account page works.

### Sample data (optional)

To start with a filled-in resume instead of a blank account, set `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`, then:

```bash
npm run seed -- path/to/your-resume.pdf   # defaults to seed/resume.pdf (git ignores the seed/ folder)
npm run library:import                    # copy the seeded resume's items into your library
```

The seed script creates that user with an already-confirmed email (or reuses it if it exists) and imports the PDF as a resume it owns. Both commands are safe to run again. The PDF parser expects a fairly standard one-column resume, so check the result in the editor.

## Commands

```bash
npm run dev           # dev server
npm run build         # production build
npm start             # serve the production build
npm run db:generate   # generate a migration after editing src/db/schema.ts
npm run db:migrate    # apply migrations to the DATABASE_URL database
npm run seed          # create the dev user and import a sample resume
npm run library:import [-- <resume-id>]  # import a resume (default: the seed) into its owner's library
npm test              # unit tests (vitest)
npm run lint
npm run typecheck
```

## Notes

- Make schema changes in `src/db/schema.ts`, then run `db:generate` and `db:migrate`. Don't edit the tables in the Supabase dashboard.
- Every user-data table has row-level security turned on with no policies, so Supabase's public API can't read it. All database access goes through the server, and every query is limited to the signed-in user.
- [CLAUDE.md](CLAUDE.md) has the detailed architecture and coding conventions.

## License

[GPL-3.0](LICENSE)
