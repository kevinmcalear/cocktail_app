-- Each note sent from the app (feedback_notes: Tell us and Report a problem)
-- is emailed to the Cocktail team as it lands, so nobody has to go looking.
--
-- A trigger on insert wakes the feedback-email edge function through pg_net
-- with the note's id; the function reads the note, signs a 7-day link to its
-- photo and sends the email through Resend. Like image-palette, it needs two
-- Vault secrets (feedback_email_url, feedback_email_secret); until they exist
-- it does nothing. It never blocks the note: a failed request only means no
-- email, and the note is still there.

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

CREATE FUNCTION "private"."request_feedback_email"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_url text;
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'feedback_email_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'feedback_email_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RETURN NULL;
    END IF;

    PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object('note_id', NEW.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-feedback-email-secret', v_secret),
        timeout_milliseconds := 10000
    );
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'request_feedback_email: %', SQLERRM;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION "private"."request_feedback_email"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "request_feedback_email" AFTER INSERT ON "public"."feedback_notes"
    FOR EACH ROW EXECUTE FUNCTION "private"."request_feedback_email"();
