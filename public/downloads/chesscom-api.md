# Chess.com Published Data API Reference

> **Source:** Chess.com PubAPI — read-only REST/JSON-LD API  
> **Last reviewed:** 2022-05-10  
> **All timestamps** are Unix timestamps (seconds since 1970-01-01 00:00:00 UTC)

---

## Overview

The PubAPI re-packages all currently public data from chess.com — information available to people who are not logged in (player data, game data, club/tournament information). Private information restricted to the logged-in user (game chat, conditional moves) is excluded.

This is **read-only** data. You cannot send game moves or other commands to Chess.com from this system.

**How to use it:**
1. Determine the data you want, and compose the URL based on the endpoint URL pattern.
2. Request that URL in your browser, program, Postman, cURL, or pigeon.
3. Enjoy the JSON.

---

## General Use

### Data Currency

About 3% of players still use the old "v2" website for some actions. When those players modify data you are requesting, the data may be out of date. This does not apply to mobile app users.

**Default refresh:** endpoints refresh at most once every 24 hours unless otherwise noted.

### Language

URL responses are the same for everyone regardless of who or where they are. In cases where the data contain words (game-ending reasons, error responses), those words will be in English.

### Rate Limiting

Serial access rate is unlimited — if you always wait for the previous response before making the next request, you should never encounter rate limiting.

Parallel requests (threaded apps, webservers handling multiple simultaneous requests) may be blocked. Be prepared to handle a `429 Too Many Requests` response for any non-serial request.

Abnormal or suspicious activity may result in your application being blocked entirely. Supplying a recognizable user-agent with contact information gives Chess.com a way to reach you if a block is necessary.

### How to Get the Data

- **Browser:** paste the endpoint URL directly into the address bar.
- **cURL:** `curl -v https://api.chess.com/pub/player/hikaru` — returns response code, ETag, date, last-modified, and more.
- **Postman / Insomnia:** a downloadable collection of all endpoints is available from Chess.com.
- **jq:** pair with cURL to filter and transform JSON on the command line.

### HTTP Responses

| Code | Meaning |
|------|---------|
| 200 | Success — enjoy your JSON |
| 301 | Redirect — URL is bad but Chess.com knows the correct one; update future requests |
| 304 | Not Modified — cached version is still current |
| 404 | Not Found — URL is malformed or the data does not exist |
| 410 | Gone — no data will ever be available at this URL; do not request it again |
| 429 | Too Many Requests — rate limit exceeded |

### JSON-LD

Each response includes a "linked data" context. JSON-LD is fully compatible with regular JSON. An HTTP `Link` header points to the JSON-LD context URL for the data format.

### JSONP

A `callback` parameter in any query string is treated as a JavaScript function name to call with the data.

Example: `https://api.chess.com/pub/player/erik?callback=myFunction`

Function names containing non-literal characters or exceeding 200 characters are stripped from the response.

### Caching

Each response includes `ETag` and `Last-Modified` headers. Supply `If-None-Match` or `If-Modified-Since` in your request to receive a `304 Not Modified` response when data has not changed.

If you request faster than the `Cache-Control` max-age, the CDN may respond directly with cached values. Response headers may indicate a cache HIT, MISS, EXPIRED, or REVALIDATED.

### HTTP Compression & HTTP/2

Send `Accept-Encoding: gzip` to receive gzip-compressed responses for large payloads (generally >200 bytes), saving up to 80% of download bandwidth.

HTTP/2 requests receive HTTP/2 responses: header compression, binary transfer, and multiplexed responses.

---

## Player Data

### Player Profile

**URL:** `https://api.chess.com/pub/player/{username}`

Get additional details about a player.

```json
{
  "@id": "URL",
  "url": "URL",
  "username": "string",
  "player_id": 41,
  "title": "string",
  "status": "string",
  "name": "string",
  "avatar": "URL",
  "location": "string",
  "country": "URL",
  "joined": 1178556600,
  "last_online": 1500661803,
  "followers": 17,
  "is_streamer": "boolean",
  "twitch_url": "Twitch.tv URL",
  "fide": "integer"
}
```

**Notes:**
- `status` values: `closed`, `closed:fair_play_violations`, `basic`, `premium`, `mod`, `staff`
- `title` values (optional): GM, WGM, IM, WIM, FM, WFM, NM, WNM, CM, WCM
- `player_id` is a convenience for detecting username changes — it never changes for a given account.

**Example:** `https://api.chess.com/pub/player/erik`  
**JSON-LD:** `https://api.chess.com/context/Player.jsonld`

---

### Titled Players

**URL:** `https://api.chess.com/pub/titled/{title-abbrev}`

List of titled-player usernames. Valid abbreviations: GM, WGM, IM, WIM, FM, WFM, NM, WNM, CM, WCM.

```json
{
  "players": [
    "array of usernames for players with this title"
  ]
}
```

**Example:** `https://api.chess.com/pub/titled/GM`  
**JSON-LD:** `https://api.chess.com/context/Players.jsonld`

---

### Player Stats

**URL:** `https://api.chess.com/pub/player/{username}/stats`

Ratings, win/loss, and other stats about a player's game play, tactics, lessons, and Puzzle Rush score.

The response contains stats objects identified by rules code + underscore + time-class code (e.g., `chess_daily`, `chess960_blitz`).

**Response wrapper:**
```json
{
  "chess_daily": { },
  "chess960_daily": { },
  "chess_blitz": { },
  "tactics": {
    "highest": { "rating": "integer", "date": "timestamp" },
    "lowest":  { "rating": "integer", "date": "timestamp" }
  },
  "lessons": {
    "highest": { "rating": "integer", "date": "timestamp" },
    "lowest":  { "rating": "integer", "date": "timestamp" }
  },
  "puzzle_rush": {
    "daily": { "total_attempts": "integer", "score": "integer" },
    "best":  { "total_attempts": "integer", "score": "integer" }
  }
}
```

**Each game-type stats object:**
```json
{
  "last": {
    "date": 1509709165,
    "rating": 1642,
    "rd": 58
  },
  "best": {
    "date": 1256228875,
    "rating": 2065,
    "game": "URL"
  },
  "record": {
    "win": 177,
    "loss": 124,
    "draw": 21,
    "time_per_move": 18799,
    "timeout_percent": 9.99
  },
  "tournament": {
    "count": 20,
    "withdraw": 1,
    "points": 39,
    "highest_finish": 1
  }
}
```

**Example:** `https://api.chess.com/pub/player/erik/stats`

---

### Player Online Status

**URL:** `https://api.chess.com/pub/player/{username}/is-online`

Tells if a user has been online in the last five minutes.

```json
{ "online": "boolean" }
```

**Example:** `https://api.chess.com/pub/player/erik/is-online`  
**JSON-LD:** `https://api.chess.com/context/PlayerIsOnline.jsonld`

---

### Current Daily Chess

**URL:** `https://api.chess.com/pub/player/{username}/games`

Array of Daily Chess games that a player is currently playing.

```json
{
  "games": [
    {
      "white": "URL",
      "black": "URL",
      "url": "string",
      "fen": "string",
      "pgn": "string",
      "turn": "black",
      "move_by": 1501765498,
      "draw_offer": "black",
      "last_activity": 1509810789,
      "start_time": 1254438881,
      "time_control": "string",
      "time_class": "string",
      "rules": "string",
      "tournament": "string",
      "match": "string"
    }
  ]
}
```

**Example:** `https://api.chess.com/pub/player/erik/games`  
**JSON-LD:** `https://api.chess.com/context/ChessGames.jsonld`

---

### To-Move Daily Chess

**URL:** `https://api.chess.com/pub/player/{username}/games/to-move`

Array of Daily Chess games where it is the player's turn to act.

```json
{
  "games": [
    {
      "url": "string",
      "move_by": 1254438881,
      "draw_offer": true,
      "last_activity": 1509810789
    }
  ]
}
```

**Note:** This list may sometimes include games where it is not the player's turn, if a draw offer has been made (in those cases `move_by` is `0`).

**Example:** `https://api.chess.com/pub/player/erik/games/to-move`

---

### List of Monthly Archives

**URL:** `https://api.chess.com/pub/player/{username}/games/archives`

Array of monthly archives available for this player.

```json
{
  "archives": [
    "array of URLs for monthly archives in ascending chronological order"
  ]
}
```

**Example:** `https://api.chess.com/pub/player/erik/games/archives`  
**JSON-LD:** `https://api.chess.com/context/GameArchives.jsonld`

---

### Complete Monthly Archive

**URL:** `https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}`

Array of Live and Daily Chess games that a player has finished.

```json
{
  "games": [
    {
      "white": {
        "username": "string",
        "rating": 1492,
        "result": "string",
        "@id": "string"
      },
      "black": {
        "username": "string",
        "rating": 1942,
        "result": "string",
        "@id": "string"
      },
      "accuracies": { "white": 0.0, "black": 0.0 },
      "url": "string",
      "fen": "string",
      "pgn": "string",
      "start_time": 1254438881,
      "end_time": 1254670734,
      "time_control": "string",
      "rules": "string",
      "eco": "string",
      "tournament": "string",
      "match": "string"
    }
  ]
}
```

**Example:** `https://api.chess.com/pub/player/erik/games/2009/10`

---

### Multi-Game PGN Download

**URL:** `https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}/pgn`

Standard multi-game PGN file containing all games for a month. Not JSON — follows the PGN standard directly. Response includes `Content-Disposition: attachment` header.

**Example:** `https://api.chess.com/pub/player/erik/games/2009/10/pgn`

---

### Player's Clubs

**URL:** `https://api.chess.com/pub/player/{username}/clubs`

List of clubs the player is a member of.

```json
{
  "clubs": [
    {
      "@id": "URL",
      "name": "string",
      "last_activity": "timestamp",
      "icon": "URL",
      "url": "URL",
      "joined": "timestamp"
    }
  ]
}
```

**Example:** `https://api.chess.com/pub/player/erik/clubs`  
**JSON-LD:** `https://api.chess.com/context/PlayerClubs.jsonld`

---

### Player Matches

**URL:** `https://api.chess.com/pub/player/{username}/matches`

List of Team matches the player has attended, is participating in, or is currently registered for.

```json
{
  "finished": [
    {
      "name": "string",
      "url": "URL",
      "@id": "URL",
      "club": "URL",
      "results": {
        "played_as_white": "win",
        "played_as_black": "win"
      },
      "board": "URL"
    }
  ],
  "in_progress": [ { "name": "string", "url": "URL", "@id": "URL", "club": "URL", "board": "URL" } ],
  "registered": [ { "name": "string", "url": "URL", "@id": "URL", "club": "URL" } ]
}
```

**Example:** `https://api.chess.com/pub/player/erik/matches`  
**JSON-LD:** `https://api.chess.com/context/PlayerMatches.jsonld`

---

### Player's Tournaments

**URL:** `https://api.chess.com/pub/player/{username}/tournaments`

List of tournaments the player is registered for, attending, or has attended.

```json
{
  "finished": [
    {
      "url": "URL",
      "@id": "URL",
      "wins": 3,
      "losses": 5,
      "draws": 0,
      "points_awarded": 0,
      "placement": 4,
      "status": "eliminated",
      "total_players": 5
    }
  ],
  "in_progress": [ { "url": "URL", "@id": "URL", "status": "eliminated" } ],
  "registered": [ { "url": "URL", "@id": "URL", "status": "invited" } ]
}
```

`status` values: `winner`, `eliminated`, `withdrew`, `removed`, `invited`

**Example:** `https://api.chess.com/pub/player/erik/tournaments`  
**JSON-LD:** `https://api.chess.com/context/PlayerTournaments.jsonld`

---

## Clubs

All club-based URLs use the club's "URL ID": `https://api.chess.com/pub/club/{url-ID}`. The url-ID matches the club's URL on www.chess.com.

### Club Profile

**URL:** `https://api.chess.com/pub/club/{url-ID}`

```json
{
  "@id": "URL",
  "name": "string",
  "club_id": 57796,
  "icon": "URL",
  "country": "URL",
  "average_daily_rating": 1376,
  "members_count": 54,
  "created": 1178556600,
  "last_activity": 1500661803,
  "visibility": "public",
  "join_request": "URL",
  "admin": [ "array of admin profile URLs" ],
  "description": "string"
}
```

**Example:** `https://api.chess.com/pub/club/chess-com-developer-community`  
**JSON-LD:** `https://api.chess.com/context/Club.jsonld`

---

### Club Members

**URL:** `https://api.chess.com/pub/club/{url-ID}/members`

List of club members grouped by activity frequency. **Cache:** refreshes at most once every 12 hours.

```json
{
  "weekly":   [ { "username": "string", "joined": "integer" } ],
  "monthly":  [ { "username": "string", "joined": "integer" } ],
  "all_time": [ { "username": "string", "joined": "integer" } ]
}
```

**Example:** `https://api.chess.com/pub/club/chess-com-developer-community/members`  
**JSON-LD:** `https://api.chess.com/context/ClubMembers.jsonld`

---

### Club Matches

**URL:** `https://api.chess.com/pub/club/{url-ID}/matches`

List of daily and club matches grouped by status.

```json
{
  "finished": [
    {
      "name": "string",
      "@id": "URL",
      "opponent": "URL",
      "result": "win",
      "start_time": 1305324926,
      "time_class": "daily"
    }
  ],
  "in_progress": [ { "name": "string", "@id": "URL", "opponent": "URL", "start_time": 0, "time_class": "daily" } ],
  "registered": [ { "name": "string", "@id": "URL", "opponent": "URL", "time_class": "daily" } ]
}
```

**Example:** `https://api.chess.com/pub/club/team-usa-southwest/matches`  
**JSON-LD:** `https://api.chess.com/context/ClubMatches.jsonld`

---

## Tournaments

All tournament-based URLs use the tournament's "URL ID": `https://api.chess.com/pub/tournament/{url-ID}`.

### Tournament

**URL:** `https://api.chess.com/pub/tournament/{url-ID}`

```json
{
  "name": "string",
  "url": "URL",
  "description": "string",
  "creator": "string",
  "status": "finished",
  "finish_time": 1251846528,
  "settings": {
    "type": "round_robin",
    "rules": "string",
    "time_class": "daily",
    "time_control": "1/259200",
    "is_rated": true,
    "is_official": false,
    "is_invite_only": false,
    "initial_group_size": 5,
    "user_advance_count": 1,
    "use_tiebreak": true,
    "allow_vacation": false,
    "winner_places": 1,
    "registered_user_count": 5,
    "games_per_opponent": 2,
    "total_rounds": 1,
    "concurrent_games_per_opponent": 1
  },
  "players": [ { "username": "string", "status": "eliminated" } ],
  "rounds": [ "list of round URLs" ]
}
```

`status` values: `finished`, `in_progress`, `registration`

**Example:** `https://api.chess.com/pub/tournament/-33rd-chesscom-quick-knockouts-1401-1600`  
**JSON-LD:** `https://api.chess.com/context/Tournament.jsonld`

---

### Tournament Round

**URL:** `https://api.chess.com/pub/tournament/{url-ID}/{round}`

```json
{
  "groups": [ "list of tournament round group URLs" ],
  "players": [ { "username": "string", "is_advancing": false } ]
}
```

**Example:** `https://api.chess.com/pub/tournament/-33rd-chesscom-quick-knockouts-1401-1600/1`  
**JSON-LD:** `https://api.chess.com/context/TournamentRound.jsonld`

---

### Tournament Round Group

**URL:** `https://api.chess.com/pub/tournament/{url-ID}/{round}/{group}`

```json
{
  "fair_play_removals": [ "usernames closed for fair play violation" ],
  "games": [
    {
      "white": "string",
      "black": "string",
      "url": "string",
      "fen": "string",
      "pgn": "string",
      "turn": "black",
      "move_by": 1501765498,
      "draw_offer": "black",
      "last_activity": 1509810789,
      "start_time": 1254438881,
      "time_control": "string",
      "time_class": "string",
      "rules": "string",
      "eco": "string",
      "tournament": "string"
    }
  ],
  "players": [
    {
      "username": "string",
      "points": 2,
      "tie_break": 6,
      "is_advancing": false
    }
  ]
}
```

**Example:** `https://api.chess.com/pub/tournament/-33rd-chesscom-quick-knockouts-1401-1600/1/1`  
**JSON-LD:** `https://api.chess.com/context/TournamentRoundGroup.jsonld`

---

## Team Matches

Daily team match: `https://api.chess.com/pub/match/{ID}`  
Live team match: `https://api.chess.com/pub/match/live/{ID}`

The ID matches the URL on www.chess.com.

### Daily Team Match

**URL:** `https://api.chess.com/pub/match/{ID}`

**During registration:**
```json
{
  "name": "string",
  "url": "URL",
  "description": "string",
  "start_time": "timestamp",
  "settings": {
    "time_class": "daily",
    "time_control": "string",
    "rules": "string",
    "min_team_players": 0,
    "max_team_players": 0,
    "min_required_games": 0,
    "min_rating": 0,
    "max_rating": 0,
    "autostart": false
  },
  "status": "registration",
  "boards": 0,
  "teams": {
    "team1": {
      "@id": "URL", "url": "URL", "name": "string", "score": 0,
      "players": [
        { "username": "string", "board": "URL", "rating": 1355,
          "rd": 25.12, "timeout_percent": 25.12, "status": "basic" }
      ]
    },
    "team2": { }
  }
}
```

**In progress / finished:**
```json
{
  "status": "finished",
  "teams": {
    "team1": {
      "@id": "URL", "name": "string", "score": 0,
      "players": [
        {
          "username": "string", "board": "URL",
          "stats": "URL",
          "played_as_white": "string",
          "played_as_black": "string"
        }
      ],
      "fair_play_removals": [ ]
    }
  }
}
```

**Note:** After the registration phase, follow each player's `stats` link for up-to-date statistics — they are not snapshotted during matches.

**Example:** `https://api.chess.com/pub/match/12803`  
**JSON-LD:** `https://api.chess.com/context/Match.jsonld`

---

### Daily Team Match Board

**URL:** `https://api.chess.com/pub/match/{ID}/{board}`

```json
{
  "board_scores": { "player1": 0.5, "player2": 1.5 },
  "games": [
    {
      "white": { "username": "string", "rating": 1492, "result": "string", "@id": "string", "team": "URL" },
      "black": { "username": "string", "rating": 1942, "result": "string", "@id": "string", "team": "URL" },
      "accuracies": { "white": 0.0, "black": 0.0 },
      "url": "string", "fen": "string", "pgn": "string",
      "start_time": 0, "end_time": 0,
      "time_control": "string", "time_class": "string",
      "rules": "string", "eco": "string", "match": "string"
    }
  ]
}
```

**Example:** `https://api.chess.com/pub/match/12803/1`  
**JSON-LD:** `https://api.chess.com/context/MatchBoard.jsonld`

---

### Live Team Match

**URL:** `https://api.chess.com/pub/match/live/{ID}`

**When scheduled:**
```json
{
  "@id": "https://api.chess.com/pub/match/live/5861",
  "name": "Friendly 10|2 Rapid Open",
  "url": "https://www.chess.com/club/matches/live/5861",
  "start_time": 1579988425,
  "status": "scheduled",
  "boards": 0,
  "settings": {
    "rules": "chess", "time_class": "standard", "time_control": 600,
    "time_increment": 2, "min_team_players": 1,
    "min_required_games": 0, "autostart": false
  },
  "teams": {
    "team1": { "@id": "URL", "name": "string", "url": "URL", "score": 0, "players": [], "fair_play_removals": [] },
    "team2": { }
  }
}
```

**When finished:**
```json
{
  "@id": "https://api.chess.com/pub/match/live/5833",
  "name": "Friendly 5+2",
  "start_time": 1579471260,
  "end_time": 1579472487,
  "status": "finished",
  "boards": 6,
  "teams": {
    "team1": {
      "score": 7, "result": "win",
      "players": [
        { "username": "string", "stats": "URL", "status": "premium",
          "played_as_white": "win", "played_as_black": "resigned", "board": "URL" }
      ]
    }
  }
}
```

**Example:** `https://api.chess.com/pub/match/live/5833`  
**JSON-LD:** `https://api.chess.com/context/Match.jsonld`

---

### Live Team Match Board

**URL:** `https://api.chess.com/pub/match/live/{ID}/{board}`

```json
{
  "board_scores": { "player1": 1.5, "player2": 0.5 },
  "games": [
    {
      "url": "string", "pgn": "string", "time_control": "300+2",
      "end_time": 1579471691, "rated": true, "time_class": "blitz", "rules": "chess",
      "fen": "r7/p4pN1/1pn4k/8/2bP3R/2P3R1/6PP/6K1 b - -",
      "white": { "rating": 1351, "result": "win", "@id": "URL", "username": "string" },
      "black": { "rating": 1458, "result": "checkmated", "@id": "URL", "username": "string" },
      "eco": "URL"
    }
  ]
}
```

**Example:** `https://api.chess.com/pub/match/live/5833/5`  
**JSON-LD:** `https://api.chess.com/context/MatchBoard.jsonld`

---

## Countries

All country-based URLs use the 2-character ISO 3166 code (capitalized): `https://api.chess.com/pub/country/{iso}`

Chess.com also supports regions not in the ISO list using user-assigned codes:

| Code | Region |
|------|--------|
| XA | Canary Islands |
| XB | Basque Country |
| XC | Catalonia |
| XE | England |
| XG | Galicia |
| XK | Kosovo |
| XP | Palestine |
| XS | Scotland |
| XW | Wales |
| XX | International |

### Country Profile

**URL:** `https://api.chess.com/pub/country/{iso}`

```json
{
  "@id": "URL",
  "name": "string",
  "code": "string"
}
```

**Example:** `https://api.chess.com/pub/country/IT`  
**JSON-LD:** `https://api.chess.com/context/Country.jsonld`

---

### Country Players

**URL:** `https://api.chess.com/pub/country/{iso}/players`

List of usernames for players who identify themselves as being in this country. **Cache:** refreshes at most once every 12 hours.

```json
{
  "players": [ "array of usernames for recently active players" ]
}
```

**Note:** Complete lists of all players are not available. Requesting once per day yields all new registrants and currently active players.

**Example:** `https://api.chess.com/pub/country/IT/players`  
**JSON-LD:** `https://api.chess.com/context/CountryPlayers.jsonld`

---

### Country Clubs

**URL:** `https://api.chess.com/pub/country/{iso}/clubs`

List of URLs for clubs identified as being in or associated with this country.

```json
{
  "clubs": [ "array of profile URLs for clubs in this country" ]
}
```

**Example:** `https://api.chess.com/pub/country/IT/clubs`  
**JSON-LD:** `https://api.chess.com/context/CountryClubs.jsonld`

---

## Daily Puzzles

### Daily Puzzle

**URL:** `https://api.chess.com/pub/puzzle`

```json
{
  "title": "string",
  "url": "URL",
  "publish_time": 1513584000,
  "fen": "string",
  "pgn": "string",
  "image": "URL"
}
```

**Note:** If you publish the Daily Puzzle, please give credit to Chess.com with a clearly visible text link to the puzzle page URL.

**Example:** `https://api.chess.com/pub/puzzle`  
**JSON-LD:** `https://api.chess.com/context/DailyPuzzle.jsonld`

---

### Random Daily Puzzle

**URL:** `https://api.chess.com/pub/puzzle/random`

Information about a randomly picked daily puzzle. The puzzle doesn't change with every request — there is a caching latency of around 15 seconds.

Same data format as Daily Puzzle.

**Example:** `https://api.chess.com/pub/puzzle/random`

---

## Streamers

**URL:** `https://api.chess.com/pub/streamers`

Information about Chess.com streamers. Refreshes every 5 minutes.

```json
{
  "streamers": [
    {
      "username": "string",
      "avatar": "URL",
      "twitch_url": "Twitch.tv URL",
      "url": "string"
    }
  ]
}
```

**Example:** `https://api.chess.com/pub/streamers`

---

## Leaderboards

**URL:** `https://api.chess.com/pub/leaderboards`

Top 50 players for daily and live games, tactics, and lessons. Refreshes when one of the leaderboards is updated.

Arrays: `daily`, `daily960`, `live_rapid`, `live_blitz`, `live_bullet`, `live_bughouse`, `live_blitz960`, `live_threecheck`, `live_crazyhouse`, `live_kingofthehill`, `lessons`, `tactics`

**Each entry:**
```json
{
  "player_id": "integer",
  "@id": "URL",
  "url": "URL",
  "username": "string",
  "score": "integer",
  "rank": "integer"
}
```

**Example:** `https://api.chess.com/pub/leaderboards`

---

## Game Results Codes

| Code | Description |
|------|-------------|
| `win` | Win |
| `checkmated` | Checkmated |
| `agreed` | Draw agreed |
| `repetition` | Draw by repetition |
| `timeout` | Timeout |
| `resigned` | Resigned |
| `stalemate` | Stalemate |
| `lose` | Lose |
| `insufficient` | Insufficient material |
| `50move` | Draw by 50-move rule |
| `abandoned` | Abandoned |
| `kingofthehill` | Opponent king reached the hill |
| `threecheck` | Checked for the 3rd time |
| `timevsinsufficient` | Draw by timeout vs insufficient material |
| `bughousepartnerlose` | Bughouse partner lost |

---

*Source: [chess.com/news/view/published-data-api](https://www.chess.com/news/view/published-data-api) — Last reviewed 2022-05-10*
