-- Local stack only: `supabase db reset` loads this after the migrations.
-- Production never runs seed files.

-- Lets the images trigger reach the local image-palette function (served by
-- the edge runtime; `kong` is the gateway's name on the stack's Docker network).
-- The secret matches LOCAL_IMAGE_PALETTE_SECRET in functions/_shared/localStack.ts,
-- which the function accepts only on a local stack.
SELECT vault.create_secret('http://kong:8000/functions/v1/image-palette', 'image_palette_url');
SELECT vault.create_secret('local-image-palette-secret', 'image_palette_secret');

-- Lets the flavor queue reach the local flavor-worker. The secret matches
-- LOCAL_FLAVOR_WORKER_SECRET; on a local stack the AI fill is always mocked.
SELECT vault.create_secret('http://kong:8000/functions/v1/flavor-worker', 'flavor_worker_url');
SELECT vault.create_secret('local-flavor-worker-secret', 'flavor_worker_secret');
