-- Bolt Database schema for admin nudge system

create table if not exists nudge_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  message_body text not null,
  template_type text not null,
  target_audience text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists nudges_sent (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  template_id uuid references nudge_templates(id) on delete set null,
  sent_at timestamptz not null default now(),
  sent_by_admin_id text,
  delivery_status text not null default 'pending',
  channel text not null default 'email',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists nudge_effectiveness (
  id uuid primary key default gen_random_uuid(),
  nudge_id uuid references nudges_sent(id) on delete cascade,
  user_id text not null,
  engagement_score_before numeric,
  engagement_score_after numeric,
  tasks_completed_before integer,
  tasks_completed_after integer,
  days_to_response integer,
  responded boolean not null default false,
  measured_at timestamptz not null default now()
);

create table if not exists nudge_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  target_risk_levels text[] not null default '{}'::text[],
  start_date date,
  end_date date,
  created_by text,
  status text not null default 'draft'
);

create index if not exists nudges_sent_user_id_idx on nudges_sent(user_id);
create index if not exists nudges_sent_template_id_idx on nudges_sent(template_id);
create index if not exists nudges_sent_sent_at_idx on nudges_sent(sent_at);
create index if not exists nudge_effectiveness_user_id_idx on nudge_effectiveness(user_id);
create index if not exists nudge_effectiveness_nudge_id_idx on nudge_effectiveness(nudge_id);
