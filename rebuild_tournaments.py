#!/usr/bin/env python3
"""
rebuild_tournaments.py
Scans tours directory and rebuilds tournaments.html table
"""

import os
import re
import json
import sys
from pathlib import Path
from datetime import datetime

# Configuration
TOURS_DIR = "./tours"  # Change this to your tours directory
HTML_FILE = "./tournaments.html"  # Your main HTML file
INDEX_JSON = "./tours/index.json"  # Optional: for client-side loading

def parse_pgn_headers(pgn_path):
    """Parse headers from a PGN file."""
    try:
        with open(pgn_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"  Error reading {pgn_path}: {e}")
        return {}
    
    headers = {}
    header_regex = re.compile(r'\[(\w+)\s+"([^"]*)"\]')
    
    for match in header_regex.finditer(content):
        headers[match.group(1).lower()] = match.group(2)
    
    return headers

def calculate_tournament_stats(pgn_path):
    """Calculate tournament statistics."""
    try:
        with open(pgn_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"  Error reading {pgn_path}: {e}")
        return {'players': 0, 'games': 0, 'avg_elo': 0, 'category': 0, 'complete_ratings': False}
    
    # Split into games - more robust splitting
    games = []
    # Look for [Event tags to split games
    event_positions = [m.start() for m in re.finditer(r'(?=\[Event\s+")', content)]
    
    if not event_positions:
        # If no Event tags found, treat entire content as one game
        games = [content]
    else:
        for i, pos in enumerate(event_positions):
            if i < len(event_positions) - 1:
                games.append(content[pos:event_positions[i+1]])
            else:
                games.append(content[pos:])
    
    games = [g for g in games if g.strip()]
    
    players = set()
    rated_players = {}
    missing_ratings = False
    
    for game in games:
        headers = {}
        header_matches = re.findall(r'\[(\w+)\s+"([^"]*)"\]', game)
        for key, value in header_matches:
            headers[key.lower()] = value
        
        white = headers.get('white', '')
        black = headers.get('black', '')
        white_elo = headers.get('whiteelo', '')
        black_elo = headers.get('blackelo', '')
        
        if white:
            players.add(white)
            if white_elo and white_elo.strip().isdigit():
                rated_players[white] = int(white_elo.strip())
            else:
                missing_ratings = True
        
        if black:
            players.add(black)
            if black_elo and black_elo.strip().isdigit():
                rated_players[black] = int(black_elo.strip())
            else:
                missing_ratings = True
    
    total_players = len(players)
    total_games = len(games)
    
    avg_elo = 0
    category = 0
    
    if not missing_ratings and total_players > 0 and len(rated_players) == total_players:
        avg_elo = sum(rated_players.values()) // total_players
        if avg_elo >= 2251:
            category = ((avg_elo - 2251) // 25) + 1
    
    return {
        'players': total_players,
        'games': total_games,
        'avg_elo': avg_elo,
        'category': category,
        'complete_ratings': not missing_ratings
    }

def extract_tournament_info(pgn_path):
    """Extract tournament info from filename and PGN."""
    try:
        filename = os.path.basename(pgn_path)
        name_no_ext = os.path.splitext(filename)[0]
        
        # Parse dates from filename (format: YYYYMMDD-YYYYMMDD-name.pgn)
        date_match = re.match(r'(\d{8})-(\d{8})-(.+)', name_no_ext)
        
        if date_match:
            start_date = date_match.group(1)
            end_date = date_match.group(2)
            slug = date_match.group(3)
        else:
            # Try alternative format without dates
            start_date = "00000000"
            end_date = "00000000"
            slug = name_no_ext
        
        # Get event name from PGN
        headers = parse_pgn_headers(pgn_path)
        event_name = headers.get('event', slug.replace('-', ' ').title())
        
        # Clean up event name
        if not event_name or event_name == '""':
            event_name = slug.replace('-', ' ').title()
        
        # Calculate stats
        stats = calculate_tournament_stats(pgn_path)
        
        return {
            'filename': filename,
            'slug': slug,
            'start_date': start_date,
            'end_date': end_date,
            'name': event_name,
            'file_path': f"tours/{filename}",
            **stats
        }
    except Exception as e:
        print(f"  Error processing {pgn_path}: {e}")
        return None

def build_tournament_rows(tournaments):
    """Build HTML table rows for tournaments."""
    rows = []
    
    for tour in sorted(tournaments, key=lambda x: x['start_date']):
        try:
            start_fmt = f"{tour['start_date'][:4]}-{tour['start_date'][4:6]}-{tour['start_date'][6:8]}"
            end_fmt = f"{tour['end_date'][:4]}-{tour['end_date'][4:6]}-{tour['end_date'][6:8]}"
            
            # Category badge
            if tour['category'] > 0:
                elite_class = 'cat-elite' if tour['category'] >= 15 else ''
                cat_cell = f'<span class="cat-badge {elite_class}">{tour["category"]}</span>'
            else:
                cat_cell = '<span class="cat-badge">-</span>'
            
            row = f'''    <tr data-elo="{tour['avg_elo']}">
        <td style="font-weight: 500;">{tour['name']}</td>
        <td style="white-space: nowrap;">{start_fmt}</td>
        <td style="white-space: nowrap;">{end_fmt}</td>
        <td style="text-align: center;">{tour['players']}</td>
        <td style="text-align: center;">{tour['games']}</td>
        <td style="font-family: monospace;">{tour['avg_elo'] or '-'}</td>
        <td class="cat-cell">{cat_cell}</td>
        <td style="text-align: right;">
            <a href="{tour['file_path']}" class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" download>
                <span class="material-icons" style="font-size: 1.1em; vertical-align: text-bottom; margin-right: 4px;">cloud_download</span>PGN
            </a>
        </td>
    </tr>'''
            
            rows.append(row)
        except Exception as e:
            print(f"  Error building row for {tour.get('name', 'Unknown')}: {e}")
    
    return '\n'.join(rows)

def update_html_file(tournaments):
    """Update tournaments.html with new tournament data."""
    try:
        with open(HTML_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Build new table body
        table_body = build_tournament_rows(tournaments)
        
        # Replace the table body content
        # Find <tbody> and replace everything until </tbody>
        tbody_start = content.find('<tbody>')
        tbody_end = content.find('</tbody>')
        
        if tbody_start != -1 and tbody_end != -1:
            new_content = content[:tbody_start + 7] + '\n' + table_body + '\n    ' + content[tbody_end:]
            
            # Update tournament count
            count_text = f'{len(tournaments)} tournaments'
            new_content = re.sub(
                r'<span class="stats" id="tourCount">.*?</span>',
                f'<span class="stats" id="tourCount">{count_text}</span>',
                new_content
            )
            
            with open(HTML_FILE, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print(f"Updated {HTML_FILE} with {len(tournaments)} tournaments")
        else:
            print("Error: Could not find <tbody> in HTML file")
    except Exception as e:
        print(f"Error updating HTML file: {e}")

def create_index_json(tournaments):
    """Create a JSON index for client-side loading (optional)."""
    try:
        index_data = {
            'last_updated': datetime.now().isoformat(),
            'tournament_count': len(tournaments),
            'tournaments': tournaments
        }
        
        # Ensure tours directory exists
        os.makedirs(os.path.dirname(INDEX_JSON), exist_ok=True)
        
        with open(INDEX_JSON, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2, default=str)
        
        print(f"Created index at {INDEX_JSON}")
    except Exception as e:
        print(f"Error creating index JSON: {e}")

def main():
    """Main function to scan tours and update HTML."""
    print(f"Scanning tours directory: {TOURS_DIR}")
    
    if not os.path.exists(TOURS_DIR):
        print(f"Error: Tours directory not found at {TOURS_DIR}")
        print(f"Creating {TOURS_DIR} directory...")
        os.makedirs(TOURS_DIR, exist_ok=True)
        print(f"Please add PGN files to {TOURS_DIR} and run the script again.")
        return
    
    # Find all PGN files
    pgn_files = []
    for root, dirs, files in os.walk(TOURS_DIR):
        for file in files:
            if file.lower().endswith('.pgn'):
                pgn_files.append(os.path.join(root, file))
    
    print(f"Found {len(pgn_files)} PGN files")
    
    if not pgn_files:
        print(f"No PGN files found in {TOURS_DIR}")
        print("Please add PGN files with naming format: YYYYMMDD-YYYYMMDD-tournament-name.pgn")
        return
    
    # Process each PGN file
    tournaments = []
    for pgn_file in pgn_files:
        print(f"  Processing: {os.path.basename(pgn_file)}")
        try:
            tour_info = extract_tournament_info(pgn_file)
            if tour_info:
                tournaments.append(tour_info)
                print(f"    ✓ {tour_info['name']} - {tour_info['players']} players, {tour_info['games']} games")
            else:
                print(f"    ✗ Failed to process")
        except Exception as e:
            print(f"    ✗ Error: {e}")
    
    # Sort by date
    tournaments.sort(key=lambda x: x['start_date'])
    
    # Update HTML file
    update_html_file(tournaments)
    
    # Optional: Create JSON index for client-side loading
    # create_index_json(tournaments)
    
    print("\nDone!")

if __name__ == "__main__":
    main()