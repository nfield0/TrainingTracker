# Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run:

```sql
create table if not exists public.tracker_state (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
```

3. Copy [.env.example](.env.example) to .env and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

4. Restart the Vite dev server.
