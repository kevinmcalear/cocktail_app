-- bar_invites policies (20260929200000): wrap auth.jwt() itself in a
-- subquery, `(SELECT auth.jwt()) ->> 'email'`, the form the auth_rls_initplan
-- advisor recognises. The old form already ran once per query, but the
-- advisor flagged it. Who can read and delete invites is unchanged.

ALTER POLICY "bar_invites_select" ON "public"."bar_invites"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(40))
        OR "email" = lower((SELECT "auth"."jwt"()) ->> 'email'));

ALTER POLICY "bar_invites_delete" ON "public"."bar_invites"
    USING ("bar_id" IN (SELECT "private"."my_bar_ids"(40))
        OR "email" = lower((SELECT "auth"."jwt"()) ->> 'email'));
