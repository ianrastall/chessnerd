# build_jsonls.py

Efficiently fetch game movelists from Lichess API and save them as JSONL files for the puzzle interface.

## Overview

This script processes EPD puzzle files from `data/lichess-buckets/` and fetches the corresponding game movelists from Lichess. It uses parallel workers and bulk API endpoints for high throughput.

## Features

- **Parallel Fetching**: Uses 8 worker threads for concurrent processing
- **Bulk Export**: Fetches up to 300 games per API request
- **Token Support**: Supports Lichess API tokens for 20x higher rate limits
- **Resume Support**: Automatically skips games that have already been fetched
- **Thread-Safe Rate Limiting**: Sliding window rate limiter ensures we stay within API limits
- **Fallback Strategy**: Falls back to individual fetches for any games missing from bulk response

## Configuration

| Constant | Value | Description |
|----------|-------|-------------|
| `NUM_WORKERS` | 8 | Number of parallel worker threads |
| `REQUESTS_PER_SECOND` | 15 | Rate limit (safe for authenticated users) |
| `BATCH_SIZE` | 300 | Number of games per bulk request |
| `MAX_RETRIES` | 3 | Number of retry attempts for failed requests |

## Usage

### Without API Token (Slower)

```bash
python build_jsonls.py
```

- Rate limit: ~1 request/second
- Expected throughput: ~300 games/minute

### With API Token (Recommended)

```bash
export LICHESS_TOKEN="lip_xxxxxxxxxxxx"
python build_jsonls.py
```

- Rate limit: ~20 requests/second (configured at 15 for safety)
- Expected throughput: ~4,500 games/minute

### Getting a Lichess API Token

1. Log in to your Lichess account
2. Go to https://lichess.org/account/oauth/token
3. Create a new token with permissions (none required for public game access)
4. Copy the token (starts with `lip_`)
5. Set it in your environment: `export LICHESS_TOKEN="lip_..."`

## Output Format

The script creates JSONL files in each bucket directory:

```
data/lichess-buckets/1500-1599/games-1500-1599.jsonl
```

Each line is a JSON object:

```json
{"id": "SHHHsXB9", "moves": ["d2d4", "e7e6", "e2e3", ...]}
```

## Resume Support

The script automatically detects existing JSONL files and skips games that have already been fetched. This means you can:

- Stop the script at any time (Ctrl+C)
- Restart it later to continue where you left off
- Add new puzzles and re-run to fetch only new games

## Architecture

### Components

1. **RateLimiter**: Thread-safe sliding window rate limiter
2. **fetch_games_bulk()**: Bulk API endpoint handler (300 games/request)
3. **fetch_game_pgn()**: Individual game fetch (fallback)
4. **process_game_batch()**: Batch processor with fallback logic
5. **process_bucket()**: Main bucket processor with parallel execution

### Data Flow

```
EPD files → Parse game IDs → Check existing games → 
Split into batches → Parallel fetch (bulk + fallback) → 
Convert PGN to UCI → Append to JSONL
```

### Thread Safety

- Rate limiter uses `threading.Lock` for thread-safe request tracking
- Sleeps outside the lock to maintain parallelization
- Each worker processes independent batches

## Error Handling

The script handles various error conditions gracefully:

- **404 (Not Found)**: Game deleted or unavailable - skipped
- **429 (Rate Limited)**: Exponential backoff (5s, 10s, 15s)
- **Network Errors**: Retry up to 3 times with 2s delay
- **Parse Errors**: Logged and skipped
- **Keyboard Interrupt**: Clean exit with progress saved

## Performance Tips

1. **Use an API token**: 15x throughput improvement
2. **Let it run**: The script is most efficient when processing large batches
3. **Don't interrupt often**: Resume support works, but starting fresh batches is more efficient
4. **Check logs**: Monitor for rate limiting or errors

## Troubleshooting

### "Rate limited" messages appearing

- You may be hitting Lichess rate limits
- Try reducing `REQUESTS_PER_SECOND` (e.g., to 10 or 12)
- Ensure your API token is valid and active

### Games missing from bulk response

- Normal behavior - some games may be deleted or private
- Script automatically falls back to individual fetch
- Check console for "Falling back to individual fetch" messages

### Script is slow

- Check if you're using an API token
- Verify `NUM_WORKERS` is set to 8
- Ensure you have a good internet connection

## Dependencies

```bash
pip install chess requests
```

- **chess**: For PGN parsing and UCI conversion
- **requests**: For HTTP API calls

## Example Output

```
============================================================
Lichess Game Fetcher
============================================================
✅ Using API token (rate limit: ~15 req/sec)
Workers: 8
Batch size: 300
============================================================
Found 32 bucket directories

📁 Processing bucket: 1500-1599
  Found 3421 game IDs in lichess-1500.epd
  Found 2834 game IDs in lichess-1501.epd
  Total unique games: 32451
  Found 15234 existing games, will skip those
  Fetching 17217 games (15234 already done)...
  Processing 58 batches with 8 workers...
  Batch 1/58 complete: 298 games fetched
  Batch 2/58 complete: 300 games fetched
  ...
  ✅ Wrote 17102 new games to games-1500-1599.jsonl
  📊 Total games in file: 32336/32451
```

## Files Modified

This script modifies files in:
- `data/lichess-buckets/*/games-*.jsonl` (created/appended)

## License

Part of the Chess Nerd project.
