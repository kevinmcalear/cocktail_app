-- In-app account deletion (App Store guideline 5.1.1(v), Google Play's
-- account deletion policy). The delete-account edge function calls
-- prepare_account_deletion, removes the user's avatar files, then deletes the
-- auth user. Deleting the auth user cascades to memberships, preferences,
-- drafts, catalog-admin rights and AI usage, and clears created_by on items,
-- menus and templates (that content stays with its bar, anonymised).

ALTER TABLE "public"."drafts" DROP CONSTRAINT "drafts_user_id_fkey";
ALTER TABLE "public"."drafts" ADD CONSTRAINT "drafts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE FUNCTION "public"."prepare_account_deletion"("p_user_id" "uuid") RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar record;
BEGIN
    -- A bar must keep an admin: refuse while this user is the only admin of a
    -- bar that still has other members.
    FOR v_bar IN
        SELECT b.name
        FROM public.user_bars ub
        JOIN public.bars b ON b.id = ub.bar_id
        WHERE ub.user_id = p_user_id
          AND ub.role_level >= 40
          AND EXISTS (
              SELECT 1 FROM public.user_bars o
              WHERE o.bar_id = ub.bar_id AND o.user_id <> p_user_id
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.user_bars o
              WHERE o.bar_id = ub.bar_id AND o.user_id <> p_user_id AND o.role_level >= 40
          )
    LOOP
        RAISE EXCEPTION 'Make someone else an admin of % before deleting your account.', v_bar.name
            USING ERRCODE = 'P0001';
    END LOOP;

    -- Bars where this user is the only member leave with them, contents included.
    FOR v_bar IN
        SELECT ub.bar_id AS id
        FROM public.user_bars ub
        WHERE ub.user_id = p_user_id
          AND NOT EXISTS (
              SELECT 1 FROM public.user_bars o
              WHERE o.bar_id = ub.bar_id AND o.user_id <> p_user_id
          )
    LOOP
        DELETE FROM public.drafts WHERE bar_id = v_bar.id;
        DELETE FROM public.menus WHERE bar_id = v_bar.id;
        DELETE FROM public.items WHERE bar_id = v_bar.id;
        DELETE FROM public.bars WHERE id = v_bar.id;
    END LOOP;

    -- Personal menus are private working documents; delete them. Personal
    -- items can be ingredients in other people's recipes, so they stay and are
    -- anonymised by the created_by foreign key.
    DELETE FROM public.menus WHERE bar_id IS NULL AND created_by = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."prepare_account_deletion"("p_user_id" "uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."prepare_account_deletion"("p_user_id" "uuid") TO "service_role";
