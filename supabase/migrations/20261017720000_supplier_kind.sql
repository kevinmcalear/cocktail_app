-- Suppliers: who a venue buys from (a spirits distributor, an ice company, a
-- produce and garnish wholesaler, a glassware supplier). Their pages work like
-- makers' pages: owned by a venue team, claimed the same way. The rest of the
-- change is 20261017530100; a new enum value can't be used in the transaction
-- that adds it.

ALTER TYPE "public"."profile_kind" ADD VALUE IF NOT EXISTS 'supplier';
