create table drafts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    entity_type text not null check (entity_type in ('cocktail', 'ingredient', 'beer', 'wine', 'menu')),
    draft_data jsonb not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Enable RLS
alter table drafts enable row level security;

-- Policies
create policy "Users can view their own drafts"
    on drafts for select
    using (auth.uid() = user_id);

create policy "Users can insert their own drafts"
    on drafts for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own drafts"
    on drafts for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own drafts"
    on drafts for delete
    using (auth.uid() = user_id);
