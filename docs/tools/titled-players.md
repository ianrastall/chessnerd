# Chess.com Titled Players

Public route: https://chessnerd.net/titled-players.html

The browser loads the static `/data/titled-players.json` snapshot, with filters,
sorting, pagination and CSV export. It does not scrape the leaderboard or
request every player's profile from the visitor's browser.

`scripts/sync-titled-players.py` runs daily at **03:23 UTC** in the existing
`Sync Titled Players Data` workflow. The source is Chess.com's
[Published Data API](https://www.chess.com/news/view/published-data-api): all ten
`/pub/titled/{title}` lists, `/pub/player/{username}/stats` and profiles at
`/pub/player/{username}`. The API leaderboard is limited to its top-ranked
cohort, so it is not a replacement for the complete titled-player lists.

Ratings refresh once per UTC day, profiles weekly. Requests run serially with
an identifying User-Agent, bounded retries and a five-and-a-half-hour total
budget (`MAX_RUN_SECONDS=19800`). The Actions job allows six hours, leaving
30 minutes for setup, checkpoint saving and build validation. The
API may serve cached data; fetch time does not claim real-time rating currency.

All title lists must succeed, and removals greater than 10% fail validation.
Known data is never mutated by a partial player response. A failed stats or
required profile fetch cannot zero known ratings or advance its timestamp.
An empty successful stats object means an account with no rated games and is
distinct from a failed request. A stats or profile HTTP 404 is never
interpreted as zero ratings. Chess.com lists some accounts whose stats endpoint
returns 404 while the profile loads, sometimes only for a day. Those players
are left out of that day's snapshot and listed in the metadata's `unavailable`
field; their known data stays in the checkpoint for later runs. If more than 1%
of the cohort returns 404, the run fails and the public snapshot is kept.

Private progress is saved every 50 players in `.cache/titled-players.json`,
restored/saved by Actions cache even on failure. Only successful daily stats
checkpoints are reused as fresh; legacy `updated_at` values cannot establish
freshness. Failed/incomplete/time-limited runs exit unsuccessfully and leave
the public snapshot untouched. A subsequent run on the same UTC day resumes
valid stats progress; on a later UTC day, stats must be fetched again.
Increasing the budget addresses runtime exhaustion, but persistent API errors
still block publication. Retry the workflow after the upstream error clears.

After the whole daily cohort succeeds, the job writes the existing flat-array
schema plus optional `stats_updated_at` and `profile_updated_at` fields, and a
metadata sibling recording counts, coverage times, removals, unavailable
accounts and zero failures.
It validates the site build before committing and chains deployment only on
success. The page displays the cohort's full date range, not its single newest
record; old snapshots are labelled with record dates until verified timestamps
are available for every player.

Run locally with `python scripts/sync-titled-players.py` (requires `requests`),
or manually dispatch the workflow to retry now. No API key is required.
