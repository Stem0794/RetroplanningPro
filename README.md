<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1zAMnqcy_vveQJOhBwtIBOZ69HtoMROfV

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Supabase app config

Create a `.env.local` with:
```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_SUPABASE_EMAIL=<app-user-email>
VITE_SUPABASE_PASSWORD=<app-user-password>
```

Use a Supabase Auth user (email/password) that should own the data; RLS policies rely on `auth.uid()`. Keep these secrets out of source control.

### GitHub Secrets

Add these in **Settings → Secrets → Actions** so CI builds without exposing keys:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_EMAIL`
- `VITE_SUPABASE_PASSWORD`

The workflow `.github/workflows/ci.yml` consumes those secrets to run `npm run build`.

## Supabase database

The SQL to create the project storage lives in `supabase/migrations/20250105_create_projects_schema.sql`. To apply it:

1. Create a Supabase project and open the SQL Editor.
2. Paste and run the contents of the migration file to create tables for `projects`, `subprojects`, `phases`, and `holidays`, plus the `phase_type` enum and indexes.
3. RLS is enabled with per-user ownership (`owner_id` defaults to `auth.uid()`). When seeding data with the service role, set `owner_id` to the intended user explicitly. If you prefer fully public access, adjust or remove the policies after running the script.
