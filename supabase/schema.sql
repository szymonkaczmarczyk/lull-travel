create table if not exists public.entries (
  collection text not null check (collection in ('stays', 'destinations', 'journal')),
  slug text not null,
  position integer not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, slug)
);

create sequence if not exists public.enquiry_ref_seq;

create table if not exists public.enquiries (
  id text primary key default ('LUL-' || lpad(nextval('public.enquiry_ref_seq')::text, 4, '0')),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new',
  name text not null,
  email text not null,
  party integer not null check (party between 1 and 12),
  month text not null default '',
  destination text not null default '',
  stay text not null default '',
  message text not null default '',
  assignee text,
  history jsonb not null default '[]'::jsonb
);

create index if not exists enquiries_received_at_idx on public.enquiries (received_at desc);
create index if not exists enquiries_status_idx on public.enquiries (status);
create index if not exists enquiries_assignee_idx on public.enquiries (assignee);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  enquiry_id text references public.enquiries (id) on delete set null,
  kind text not null,
  recipients text[] not null,
  reply_to text,
  subject text not null,
  body text not null,
  transport text not null,
  status text not null check (status in ('logged', 'sent', 'failed')),
  error text
);

create index if not exists email_log_created_at_idx on public.email_log (created_at desc);
create index if not exists email_log_enquiry_idx on public.email_log (enquiry_id);

create or replace view public.enquiry_status_counts
with (security_invoker = true) as
  select status, count(*)::int as count
  from public.enquiries
  group by status;

alter table public.entries enable row level security;
alter table public.enquiries enable row level security;
alter table public.settings enable row level security;
alter table public.email_log enable row level security;

revoke all on public.entries, public.enquiries, public.settings, public.email_log, public.enquiry_status_counts
  from anon, authenticated;
revoke all on sequence public.enquiry_ref_seq from anon, authenticated;
