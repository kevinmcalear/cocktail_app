-- Remove ambiguous overload so RPC always targets branding-aware function.
DROP FUNCTION IF EXISTS public.update_bar_settings(
    uuid,
    text,
    integer,
    integer,
    integer,
    integer,
    integer
);

NOTIFY pgrst, 'reload schema';
