-- Emailing a venue's other Admins when one asks to delete it (after
-- 20261121400000, which only tells them in the app).
--
-- venue_delete_requests.emailed_at: when the venue-delete-email function
-- emailed them about this request. The function claims it (null to now)
-- before sending, so a request is emailed once however often the app calls.
-- Undo removes the request, so asking again is a new request and a new email.
-- Only the function (service role) writes it; members still only read.

ALTER TABLE public.venue_delete_requests ADD COLUMN emailed_at timestamptz;
COMMENT ON COLUMN public.venue_delete_requests.emailed_at IS 'When the other Admins were emailed about this request (venue-delete-email). Null until then.';
