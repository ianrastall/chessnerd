# Chess.com Titled Players

The Titled Players page is routed through `src/pages/titled-players.astro`.

## How It Works

On load, the page fetches the selected title list from:

```text
https://api.chess.com/pub/titled/{TITLE}
```

When a player is selected, it fetches:

- profile: `https://api.chess.com/pub/player/{username}`
- stats: `https://api.chess.com/pub/player/{username}/stats`
- country metadata from the country URL in the profile response
- leaderboard rankings from `https://api.chess.com/pub/leaderboards`

The page keeps in-memory caches for profiles, stats, countries, and leaderboard lookups during the session.

## Automation

The page can stay live-only, but a weekly cache job would help if the Chess.com API is slow or unavailable. A safe version would generate a compact static cache of title lists only, not every player profile.

Recommended first cron target:

```text
data/chesscom-titles/{title}.json
```

The UI can then load the static title list first and still fetch profile details live when a player is selected.
