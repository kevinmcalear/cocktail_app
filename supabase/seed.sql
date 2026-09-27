-- Local stack only: `supabase db reset` loads this after the migrations.
-- Production never runs seed files.

-- Lets the images trigger reach the local image-palette function (served by
-- the edge runtime; `kong` is the gateway's name on the stack's Docker network).
-- The secret matches LOCAL_IMAGE_PALETTE_SECRET in functions/_shared/localStack.ts,
-- which the function accepts only on a local stack.
SELECT vault.create_secret('http://kong:8000/functions/v1/image-palette', 'image_palette_url');
SELECT vault.create_secret('local-image-palette-secret', 'image_palette_secret');
