# Schema

62 migrations, applied in filename order. The first is a production dump. Do not squash them: production has already run the chain.

Tests in `supabase/tests/` are the living spec. `npm run test:security` runs the RLS suite against the local stack only.

## Domains

| Domain | Tables and views | App |
| --- | --- | --- |
| Venues | `bars`, `user_bars`, `bar_invites`, `venue_roles`, `profiles` | `hooks/useCapabilities.ts`, `hooks/useBarInvites.ts` |
| Drinks | `items`, `recipes`, `app_item_presentation`, `app_recipe_presentation` | `hooks/useCocktails.ts` and the beer, wine, ingredient hooks |
| Menus | `menus`, `menu_sections`, `menu_drinks`, plus legacy `menu_templates` / `template_sections` | `hooks/useMenus.ts`, `hooks/useMenuEditor.ts` |
| Rankings | `rank_entries`, `rank_comparisons`, `private.venue_drink_scores` | `hooks/useRankings.ts` |
| Prep and cost | `item_prep`, `item_purchasing`, `item_costs`, `stock_counts` | `hooks/useStockCounts.ts`, `hooks/useMenuCosting.ts` |
| Publishing | `releases`, `published_items`, `collected_items` | `hooks/usePublished.ts`, `hooks/useCollection.ts` |
| Safety | `reports`, `user_blocks`, `private.app_admins` | `hooks/useSafety.ts` |
| AI jobs | `private.ai_usage`, `private.item_image_jobs`, `private.item_flavor_jobs` | `supabase/functions/` |

`app_recipe_presentation` and `published_items` are `security_invoker = false` on purpose: the view SQL is the access check. Do not "fix" that by flipping the flag without re-reading the view.

## Do not drop

`menu_templates`, `template_sections`, and `menu_drinks.template_section_id` still back the legacy menu editor. `menus.is_active` is kept in step with `starts_at` / `ends_at` by `sweep_menu_dates`.

## Unused, needs a human-gated migration

`attributes`, `category_attributes`, `item_attributes`, and `substitutions` have no `.from()` callers in the app, functions, or tests. Confirm they are empty in production before dropping them. `images.credit` and `images.source_url` are live columns the UI does not read yet.
