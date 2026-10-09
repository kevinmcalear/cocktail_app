-- Teammates by their real name. member_display_name only read full_name, which
-- older accounts never set (they signed up with first_name and last_name), so
-- My team, note authors and stock counts showed the part of the email before @.
-- Now: full_name, else first and last name, else their public person profile's
-- name, and only then the email.

CREATE OR REPLACE FUNCTION "private"."member_display_name"("p_user" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE(
    NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(btrim(concat_ws(' ', NULLIF(btrim(u.raw_user_meta_data ->> 'first_name'), ''), NULLIF(btrim(u.raw_user_meta_data ->> 'last_name'), ''))), ''),
    (SELECT NULLIF(btrim(p.display_name), '') FROM public.profiles p WHERE p.user_id = u.id AND p.kind = 'person' LIMIT 1),
    split_part(u.email, '@', 1)
  )
  FROM auth.users u WHERE u.id = p_user;
$$;
