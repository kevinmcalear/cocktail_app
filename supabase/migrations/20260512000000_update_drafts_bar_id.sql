alter table drafts add column bar_id uuid references bars(id);

drop policy "Users can view their own drafts" on drafts;
create policy "Users can view their own drafts or drafts in their bars"
    on drafts for select
    using (
        auth.uid() = user_id
        or 
        bar_id in (select bar_id from user_bars where user_id = auth.uid())
    );

drop policy "Users can update their own drafts" on drafts;
create policy "Users can update their own drafts or drafts in their bars"
    on drafts for update
    using (
        auth.uid() = user_id
        or 
        bar_id in (select bar_id from user_bars where user_id = auth.uid())
    )
    with check (
        auth.uid() = user_id
        or 
        bar_id in (select bar_id from user_bars where user_id = auth.uid())
    );

drop policy "Users can delete their own drafts" on drafts;
create policy "Users can delete their own drafts or drafts in their bars"
    on drafts for delete
    using (
        auth.uid() = user_id
        or 
        bar_id in (select bar_id from user_bars where user_id = auth.uid())
    );
