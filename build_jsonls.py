#!/usr/bin/env python3
"""
Extract game movelists from Lichess for puzzles and save as JSONL.
Reads EPD files, fetches games in parallel, converts to UCI, outputs one JSONL per bucket.

Features:
- Parallel fetching with 8 workers for high throughput
- Lichess API token support for 20x higher rate limits
- Bulk game export (300 games per request)
- Resume support (skips already-fetched games)
- Thread-safe rate limiting (15 req/sec with token)

Usage:
    export LICHESS_TOKEN="lip_xxxxxxxxxxxx"  # Optional but recommended
    python build_jsonls.py

Expected performance:
    With token: ~4,500 games/minute (15 req/sec × 300 games/batch)
    Without token: ~300 games/minute (1 req/sec)

Requirements: pip install chess requests
"""

import re
import json
import time
import chess
import chess.pgn
import requests
import os
import threading
from pathlib import Path
from typing import Optional, List, Set, Dict
from io import StringIO
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
EPD_ROOT = Path("data/lichess-buckets")
OUTPUT_SUFFIX = "games"  # Will create "games-1500-1599.jsonl"
NUM_WORKERS = 8
REQUESTS_PER_SECOND = 15
MAX_RETRIES = 3
BATCH_SIZE = 300

# Get Lichess API token from environment
LICHESS_TOKEN = os.environ.get("LICHESS_TOKEN")


class RateLimiter:
    """Thread-safe sliding window rate limiter."""
    
    def __init__(self, max_requests: int, time_window: float):
        """
        Args:
            max_requests: Maximum number of requests allowed in time_window
            time_window: Time window in seconds
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = []
        self.lock = threading.Lock()
    
    def acquire(self):
        """Block until a request can be made within rate limits."""
        while True:
            with self.lock:
                now = time.time()
                # Remove requests outside the time window
                self.requests = [req_time for req_time in self.requests 
                               if now - req_time < self.time_window]
                
                if len(self.requests) < self.max_requests:
                    # We can make a request
                    self.requests.append(time.time())
                    return
                
                # Calculate wait time
                oldest_request = self.requests[0]
                wait_time = self.time_window - (now - oldest_request)
            
            # Sleep outside the lock to allow other threads to proceed
            if wait_time > 0:
                time.sleep(wait_time)


def extract_game_id(url: str) -> Optional[str]:
    """Extract game ID from Lichess URL (8-12 characters)."""
    match = re.search(r'lichess\.org/([a-zA-Z0-9]{8,12})', url)
    return match.group(1) if match else None


def parse_epd_file(epd_path: Path) -> List[str]:
    """Extract all unique game IDs from an EPD file."""
    game_ids = set()
    
    with open(epd_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            # Look for c2 or c3 fields containing game URLs
            match = re.search(r'c[23]\s+"[^"]*https://lichess\.org/([a-zA-Z0-9]{8,12})', line)
            if match:
                game_ids.add(match.group(1))
    
    return sorted(game_ids)


def fetch_game_pgn(game_id: str, rate_limiter: RateLimiter) -> Optional[str]:
    """Fetch PGN from Lichess API with retries."""
    url = f"https://lichess.org/game/export/{game_id}"
    params = {
        'moves': 'true',
        'clocks': 'false',
        'evals': 'false',
        'opening': 'false'
    }
    headers = {
        'Accept': 'application/x-chess-pgn'
    }
    
    # Add authorization header if token is available
    if LICHESS_TOKEN:
        headers['Authorization'] = f'Bearer {LICHESS_TOKEN}'
    
    for attempt in range(MAX_RETRIES):
        try:
            rate_limiter.acquire()
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                return response.text
            elif response.status_code == 404:
                print(f"  ⚠️  Game {game_id} not found (404)")
                return None
            elif response.status_code == 429:
                # Rate limited - wait longer
                wait_time = 5 * (attempt + 1)
                print(f"  ⏳ Rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"  ⚠️  HTTP {response.status_code} for {game_id}")
                return None
                
        except requests.RequestException as e:
            print(f"  ⚠️  Request error for {game_id}: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(2)
                continue
            return None
    
    return None


def pgn_to_uci_moves(pgn_text: str) -> Optional[List[str]]:
    """Convert PGN to list of UCI move strings."""
    try:
        pgn = StringIO(pgn_text)
        game = chess.pgn.read_game(pgn)
        
        if not game:
            return None
        
        board = game.board()
        uci_moves = []
        
        for move in game.mainline_moves():
            uci_moves.append(move.uci())
            board.push(move)
        
        return uci_moves if uci_moves else None
        
    except Exception as e:
        print(f"  ⚠️  PGN parse error: {e}")
        return None


def fetch_games_bulk(game_ids: List[str], rate_limiter: RateLimiter) -> Dict[str, str]:
    """
    Fetch multiple games using Lichess bulk export API.
    Returns a dict mapping game_id -> PGN text.
    """
    if not game_ids:
        return {}
    
    url = "https://lichess.org/api/games/export/_ids"
    headers = {
        'Accept': 'application/x-chess-pgn',
        'Content-Type': 'text/plain'
    }
    
    # Add authorization header if token is available
    if LICHESS_TOKEN:
        headers['Authorization'] = f'Bearer {LICHESS_TOKEN}'
    
    # Join game IDs with commas
    body = ','.join(game_ids)
    
    for attempt in range(MAX_RETRIES):
        try:
            rate_limiter.acquire()
            response = requests.post(url, data=body, headers=headers, timeout=60)
            
            if response.status_code == 200:
                # Parse the response - it's PGN games separated by double newlines
                games_dict = {}
                pgn_text = response.text
                
                # Split by empty lines to separate games more robustly
                # PGN games are separated by at least one blank line
                current_game = []
                game_id = None
                
                for line in pgn_text.split('\n'):
                    if line.strip():
                        current_game.append(line)
                        # Extract game ID from Site header
                        if line.startswith('[Site "https://lichess.org/'):
                            match = re.search(r'lichess\.org/([a-zA-Z0-9]{8,12})', line)
                            if match:
                                game_id = match.group(1)
                    else:
                        # Empty line - might be end of game or just spacing
                        if current_game and game_id:
                            games_dict[game_id] = '\n'.join(current_game)
                            current_game = []
                            game_id = None
                
                # Don't forget the last game if file doesn't end with blank line
                if current_game and game_id:
                    games_dict[game_id] = '\n'.join(current_game)
                
                return games_dict
                
            elif response.status_code == 429:
                wait_time = 5 * (attempt + 1)
                print(f"  ⏳ Bulk fetch rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"  ⚠️  Bulk fetch HTTP {response.status_code}")
                return {}
                
        except requests.RequestException as e:
            print(f"  ⚠️  Bulk fetch error: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(2)
                continue
            return {}
    
    return {}


def load_existing_games(jsonl_path: Path) -> Set[str]:
    """Load game IDs that have already been fetched."""
    existing = set()
    if jsonl_path.exists():
        try:
            with open(jsonl_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        if 'id' in entry:
                            existing.add(entry['id'])
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            print(f"  ⚠️  Error reading existing games: {e}")
    return existing


def process_game_batch(game_ids: List[str], rate_limiter: RateLimiter) -> List[Dict]:
    """Process a batch of games and return results."""
    results = []
    
    # Try bulk fetch first
    bulk_games = fetch_games_bulk(game_ids, rate_limiter)
    
    # Process bulk fetched games in order, tracking which are missing
    fetched_ids = set(bulk_games.keys())
    missing_ids = []
    
    for game_id in game_ids:
        if game_id in bulk_games:
            pgn = bulk_games[game_id]
            uci_moves = pgn_to_uci_moves(pgn)
            if uci_moves:
                results.append({
                    "id": game_id,
                    "moves": uci_moves
                })
        else:
            missing_ids.append(game_id)
    
    # Fall back to individual fetches for missing games
    if missing_ids:
        print(f"  Falling back to individual fetch for {len(missing_ids)} games...")
        for game_id in missing_ids:
            pgn = fetch_game_pgn(game_id, rate_limiter)
            if pgn:
                uci_moves = pgn_to_uci_moves(pgn)
                if uci_moves:
                    results.append({
                        "id": game_id,
                        "moves": uci_moves
                    })
    
    return results


def process_bucket(bucket_path: Path):
    """Process all EPD files in a bucket folder and create JSONL with parallel fetching."""
    print(f"\n📁 Processing bucket: {bucket_path.name}")
    
    # Find all EPD files in this bucket
    epd_files = sorted(bucket_path.glob("lichess-*.epd"))
    if not epd_files:
        print("  No EPD files found, skipping")
        return
    
    # Collect all game IDs from all EPD files in bucket
    all_game_ids = set()
    for epd_file in epd_files:
        game_ids = parse_epd_file(epd_file)
        all_game_ids.update(game_ids)
        print(f"  Found {len(game_ids)} game IDs in {epd_file.name}")
    
    if not all_game_ids:
        print("  No game IDs found, skipping")
        return
    
    print(f"  Total unique games: {len(all_game_ids)}")
    
    # Output JSONL file
    jsonl_name = f"{OUTPUT_SUFFIX}-{bucket_path.name}.jsonl"
    jsonl_path = bucket_path / jsonl_name
    
    # Load existing games for resume support
    existing_games = load_existing_games(jsonl_path)
    if existing_games:
        print(f"  Found {len(existing_games)} existing games, will skip those")
    
    # Filter out already-fetched games
    games_to_fetch = sorted([gid for gid in all_game_ids if gid not in existing_games])
    
    if not games_to_fetch:
        print(f"  ✅ All games already fetched! ({len(existing_games)} games)")
        return
    
    print(f"  Fetching {len(games_to_fetch)} games ({len(existing_games)} already done)...")
    
    # Create rate limiter
    rate_limiter = RateLimiter(REQUESTS_PER_SECOND, 1.0)
    
    # Split games into batches
    batches = []
    for i in range(0, len(games_to_fetch), BATCH_SIZE):
        batches.append(games_to_fetch[i:i + BATCH_SIZE])
    
    print(f"  Processing {len(batches)} batches with {NUM_WORKERS} workers...")
    
    # Process batches in parallel
    successful = 0
    all_results = []
    
    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        # Submit all batches
        future_to_batch = {
            executor.submit(process_game_batch, batch, rate_limiter): i 
            for i, batch in enumerate(batches)
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_batch):
            batch_idx = future_to_batch[future]
            try:
                results = future.result()
                all_results.extend(results)
                successful += len(results)
                print(f"  Batch {batch_idx + 1}/{len(batches)} complete: {len(results)} games fetched")
            except Exception as e:
                print(f"  ⚠️  Batch {batch_idx + 1} failed: {e}")
    
    # Append new results to JSONL file
    if all_results:
        with open(jsonl_path, 'a', encoding='utf-8') as f:
            for entry in all_results:
                f.write(json.dumps(entry) + '\n')
        print(f"  ✅ Wrote {successful} new games to {jsonl_name}")
    
    total = len(existing_games) + successful
    print(f"  📊 Total games in file: {total}/{len(all_game_ids)}")


def main():
    """Process all bucket folders."""
    if not EPD_ROOT.exists():
        print(f"❌ EPD root not found: {EPD_ROOT}")
        return
    
    # Show configuration
    print("=" * 60)
    print("Lichess Game Fetcher")
    print("=" * 60)
    if LICHESS_TOKEN:
        print(f"✅ Using API token (rate limit: ~{REQUESTS_PER_SECOND} req/sec)")
    else:
        print(f"⚠️  No API token (slower rate limit)")
        print(f"   Set LICHESS_TOKEN env var for faster fetching")
    print(f"Workers: {NUM_WORKERS}")
    print(f"Batch size: {BATCH_SIZE}")
    print("=" * 60)
    
    # Find all bucket directories
    bucket_dirs = [d for d in EPD_ROOT.iterdir() if d.is_dir() and re.match(r'\d{4}-\d{4}', d.name)]
    
    if not bucket_dirs:
        print(f"❌ No bucket directories found in {EPD_ROOT}")
        return
    
    print(f"Found {len(bucket_dirs)} bucket directories")
    
    for bucket in sorted(bucket_dirs):
        try:
            process_bucket(bucket)
        except KeyboardInterrupt:
            print("\n⚠️  Interrupted by user")
            break
        except Exception as e:
            print(f"❌ Error processing {bucket.name}: {e}")
            continue
    
    print("\n✅ All buckets processed!")


if __name__ == "__main__":
    main()