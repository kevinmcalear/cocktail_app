-- Dropping the borrowed recipe lines queues a paid sketch. Seeded drinks
-- are never billed, so throw those jobs away.
DELETE FROM "private"."item_image_jobs" j
USING "public"."items" i
WHERE j.item_id = i.id
  AND i.notes ~ 'Spec (adapted )?from (Difford|Punch|Imbibe|The World''s 50 Best|50 Best)';
