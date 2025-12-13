#!/usr/bin/env python3
"""
Extract game movelists from Lichess for puzzles and save as JSONL.
Reads EPD files, fetches games, converts to UCI, outputs one JSONL per bucket.

Requirements: pip install chess requests
"""

import re
import json
import time
import chess
import chess.pgn
import requests
from pathlib import Path
from typing import Optional, List
from io import StringIO

# Configuration
EPD_ROOT = Path("data/lichess-buckets")
OUTPUT_SUFFIX = "games"  # Will create "games-1500-1599.jsonl"
RATE_LIMIT_DELAY = 0.5  # Seconds between API requests (be nice to Lichess)
MAX_RETRIES = 3


def extract_game_id(url: str) -> Optional[str]:
    """Extract 8-character game ID from Lichess URL."""
    match = re.search(r'lichess\.org/([a-zA-Z0-9]{8})', url)
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
            match = re.search(r'c[23]\s+"[^"]*https://lichess\.org/([a-zA-Z0-9]{8})', line)
            if match:
                game_ids.add(match.group(1))
    
    return sorted(game_ids)


def fetch_game_pgn(game_id: str) -> Optional[str]:
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
    
    for attempt in range(MAX_RETRIES):
        try:
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


def process_bucket(bucket_path: Path):
    """Process all EPD files in a bucket folder and create JSONL."""
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
    
    # Fetch and convert games
    successful = 0
    with open(jsonl_path, 'w', encoding='utf-8') as f:
        for i, game_id in enumerate(sorted(all_game_ids), 1):
            if i % 10 == 0:
                print(f"  Progress: {i}/{len(all_game_ids)} ({successful} successful)")
            
            # Fetch PGN
            pgn = fetch_game_pgn(game_id)
            if not pgn:
                time.sleep(RATE_LIMIT_DELAY)
                continue
            
            # Convert to UCI
            uci_moves = pgn_to_uci_moves(pgn)
            if not uci_moves:
                time.sleep(RATE_LIMIT_DELAY)
                continue
            
            # Write JSONL entry
            entry = {
                "id": game_id,
                "moves": uci_moves
            }
            f.write(json.dumps(entry) + '\n')
            successful += 1
            
            # Rate limiting
            time.sleep(RATE_LIMIT_DELAY)
    
    print(f"  ✅ Wrote {successful}/{len(all_game_ids)} games to {jsonl_name}")


def main():
    """Process all bucket folders."""
    if not EPD_ROOT.exists():
        print(f"❌ EPD root not found: {EPD_ROOT}")
        return
    
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