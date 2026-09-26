# Cocktail

A platform for the life of a drink. Bars create, prep, teach and pour their drinks; home bartenders collect and remake them; everyone ranks drinks and credits who made them. One Expo app for iOS, Android, web (babyvom.it) and desktop, on Supabase.

## Run it

```bash
npm install
cp .env.example .env   # fill in the Supabase URL and anon key
npm run web            # or: npm run ios / npm run android
```

To work against a local database instead of production, see [docs/dev_flow.md](docs/dev_flow.md#verify).

## Checks

```bash
npm run typecheck
npm run lint
npm run check:design   # no new raw colours/sizes/radii, `any`, or Supabase calls in UI
npm run test:unit
npm run test:security  # needs the local Supabase stack
```

## Contributing

Read [AGENTS.md](AGENTS.md) first (it applies to people too), then [docs/dev_flow.md](docs/dev_flow.md) and [docs/design_system.md](docs/design_system.md). Work on a branch, open a PR, and Kevin merges when CI is green.
