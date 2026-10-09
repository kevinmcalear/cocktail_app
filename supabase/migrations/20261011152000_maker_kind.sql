-- Makers: the houses that make what bars buy and put in or around a drink
-- (bottles, ice, garnish, glassware, barware, equipment). Their pages work
-- like bars' pages: owned by a venue team, claimed the same way. The rest of
-- the change is 20261011152100; a new enum value can't be used in the
-- transaction that adds it.

ALTER TYPE "public"."profile_kind" ADD VALUE IF NOT EXISTS 'maker';
