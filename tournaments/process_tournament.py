import sys
import os
import re
import subprocess
import zipfile
import argparse
from datetime import datetime
from collections import defaultdict

# ---------------------------------------------------------
# CONFIGURATION - Adjust these paths as needed
# ---------------------------------------------------------
BASE_DIR = r"D:\chessnerd"  # Change this to your actual chessnerd directory
PGN_EXTRACT_PATH = os.path.join(BASE_DIR, "pgn-extract.exe")
ROSTER_PATH = os.path.join(BASE_DIR, "roster.txt")
TOURNAMENTS_HTML_PATH = os.path.join(BASE_DIR, "tournaments.html")
TOURNAMENTS_DIR = os.path.join(BASE_DIR, "tournaments")

def parse_date(date_str):
    """Parse various PGN date formats into YYYYMMDD format"""
    if not date_str or date_str.strip() in ["????.??.??", "??.??.??", ""]:
        return None
    
    # Extract the first date if it's a range
    if '-' in date_str:
        date_str = date_str.split('-')[0].strip()
    
    # Replace dots and slashes with spaces
    date_str = date_str.replace('.', ' ').replace('/', ' ').replace('-', ' ')
    
    parts = date_str.strip().split()
    
    if len(parts) < 3:
        return None
    
    # Try different date format patterns
    year = None
    month = None
    day = None
    
    # Pattern 1: YYYY MM DD
    if len(parts[0]) == 4 and parts[0].isdigit() and 1000 <= int(parts[0]) <= 2100:
        year = parts[0]
        month = parts[1].zfill(2) if len(parts[1]) <= 2 and parts[1].isdigit() else '01'
        day = parts[2].zfill(2) if len(parts[2]) <= 2 and parts[2].isdigit() else '01'
    # Pattern 2: DD MM YYYY
    elif len(parts) >= 3 and len(parts[-1]) == 4 and parts[-1].isdigit() and 1000 <= int(parts[-1]) <= 2100:
        year = parts[-1]
        month = parts[1].zfill(2) if len(parts[1]) <= 2 and parts[1].isdigit() else '01'
        day = parts[0].zfill(2) if len(parts[0]) <= 2 and parts[0].isdigit() else '01'
    
    if year and month and day:
        # Validate month and day
        if 1 <= int(month) <= 12 and 1 <= int(day) <= 31:
            return f"{year}{month}{day}"
    
    return None

def extract_tournament_dates(pgn_file):
    """Extract actual playing dates from PGN file"""
    min_date = None
    max_date = None
    date_counts = defaultdict(int)
    
    try:
        with open(pgn_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Find all Date tags
        date_pattern = re.compile(r'\[Date\s+"([^"]+)"\]')
        dates = date_pattern.findall(content)
        
        for date_str in dates:
            parsed_date = parse_date(date_str)
            if parsed_date:
                date_counts[parsed_date] += 1
                
                if min_date is None or parsed_date < min_date:
                    min_date = parsed_date
                if max_date is None or parsed_date > max_date:
                    max_date = parsed_date
        
        # If we have dates, return them
        if min_date and max_date:
            print(f"  Found {len(date_counts)} unique playing dates")
            print(f"  Date range: {min_date} to {max_date}")
            
            return min_date, max_date
        
        return None, None
        
    except Exception as e:
        print(f"Error extracting dates: {e}")
        return None, None

def remove_gameid_tags(pgn_content):
    """Remove GameId tags that ChessBase adds"""
    lines = pgn_content.split('\n')
    cleaned_lines = []
    for line in lines:
        if not line.strip().startswith('[GameId'):
            cleaned_lines.append(line)
    return '\n'.join(cleaned_lines)

def run_pgn_extract(input_file, output_file):
    """Run pgn-extract with the specified command"""
    # Build the command
    cmd = [
        PGN_EXTRACT_PATH,
        input_file,
        "-R", ROSTER_PATH,
        "--xroster",
        "--fixtagstrings",
        "--fixresulttags",
        "--nosetuptags",
        "--minmoves", "1",
        "-e",
        "-D",
        "-C",
        "-V",
        "-N",
        "-w", "9999",
        "--plycount",
        "-o", output_file
    ]
    
    try:
        print(f"  Running pgn-extract on {os.path.basename(input_file)}...")
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=BASE_DIR)
        if result.returncode != 0:
            print(f"  pgn-extract error: {result.stderr}")
            return False
        print("  pgn-extract completed successfully")
        return True
    except Exception as e:
        print(f"Error running pgn-extract: {e}")
        return False

def calculate_tournament_stats(pgn_file):
    """Calculate tournament statistics (players, avg elo, category, game count)"""
    try:
        players = {}  # Format: {'Player Name': Rating}
        game_count = 0
        
        print(f"  Calculating statistics from {os.path.basename(pgn_file)}...")
        
        with open(pgn_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Count games by looking for Event tags
        game_matches = re.findall(r'\[Event\s+"[^"]+"\]', content)
        game_count = len(game_matches)
        print(f"  Found {game_count} games")
        
        if game_count == 0:
            print("  Warning: No games found in PGN file!")
            return None, None, None, 0
        
        # Use regex to find player names and ratings
        tag_regex = re.compile(r'\[(White|Black|WhiteElo|BlackElo)\s+"([^"]+)"\]')
        
        # Process the content to extract players and ratings
        lines = content.split('\n')
        current_white = None
        current_black = None
        current_white_elo = None
        current_black_elo = None
        
        for line in lines:
            match = tag_regex.match(line.strip())
            if match:
                tag_name = match.group(1)
                value = match.group(2)
                
                if tag_name == "White":
                    current_white = value
                elif tag_name == "Black":
                    current_black = value
                elif tag_name == "WhiteElo":
                    current_white_elo = value
                elif tag_name == "BlackElo":
                    current_black_elo = value
            
            # Check if we have complete player data to store
            if current_white and current_white_elo:
                if current_white_elo.isdigit():
                    players[current_white] = int(current_white_elo)
                current_white = None
                current_white_elo = None
                
            if current_black and current_black_elo:
                if current_black_elo.isdigit():
                    players[current_black] = int(current_black_elo)
                current_black = None
                current_black_elo = None
        
        print(f"  Found {len(players)} unique players with ratings")
        
        if not players:
            print("  Warning: No players with ratings found!")
            # Try alternative method - count unique White/Black names
            all_players = set()
            white_matches = re.findall(r'\[White\s+"([^"]+)"\]', content)
            black_matches = re.findall(r'\[Black\s+"([^"]+)"\]', content)
            all_players.update(white_matches)
            all_players.update(black_matches)
            print(f"  Found {len(all_players)} unique players total (without ratings)")
            return len(all_players), 0, 0, game_count
        
        # Calculate average rating
        ratings = list(players.values())
        avg_elo = sum(ratings) / len(ratings)
        
        # Calculate FIDE category
        category_num = 0
        if avg_elo >= 2251:
            category_num = int((avg_elo - 2251) // 25 + 1)
        
        return len(players), int(avg_elo), category_num, game_count
        
    except Exception as e:
        print(f"Error calculating stats: {e}")
        import traceback
        traceback.print_exc()
        return None, None, None, 0

def parse_existing_tournament_rows(html_content):
    """Parse existing tournament rows from tournaments.html"""
    rows = []
    
    # Find the tbody section
    tbody_match = re.search(r'<tbody>(.*?)</tbody>', html_content, re.DOTALL)
    if not tbody_match:
        return rows
    
    tbody_content = tbody_match.group(1)
    
    # Find all table rows with data-elo attribute
    row_pattern = r'<tr\s+data-elo="(\d+)">(.*?)</tr>'
    row_matches = re.findall(row_pattern, tbody_content, re.DOTALL)
    
    for elo_match, row_content in row_matches:
        # Extract tournament name (first td after tr)
        name_match = re.search(r'<td[^>]*style="font-weight:\s*500;"[^>]*>(.*?)</td>', row_content)
        if not name_match:
            name_match = re.search(r'<td[^>]*>(.*?)</td>', row_content)
        name = name_match.group(1).strip() if name_match else ""
        
        # Extract dates - look for td with white-space: nowrap
        date_matches = re.findall(r'<td[^>]*style="white-space:\s*nowrap;"[^>]*>(\d{4}-\d{2}-\d{2})</td>', row_content)
        start_date = date_matches[0] if len(date_matches) > 0 else ""
        end_date = date_matches[1] if len(date_matches) > 1 else ""
        
        # Extract player count (first center-aligned td after dates)
        center_tds = re.findall(r'<td[^>]*style="text-align:\s*center;"[^>]*>(\d+)</td>', row_content)
        players = center_tds[0] if len(center_tds) > 0 else "0"
        games = center_tds[1] if len(center_tds) > 1 else "0"
        
        # Extract average Elo
        elo = elo_match
        
        # Extract category
        category_match = re.search(r'<td[^>]*class="cat-cell"[^>]*>(.*?)</td>', row_content, re.DOTALL)
        category = ""
        if category_match:
            # Extract just the number from the badge if present
            cat_text = category_match.group(1).strip()
            cat_num_match = re.search(r'>(\d+)<', cat_text)
            if cat_num_match:
                category = cat_num_match.group(1)
            elif cat_text == "-" or not cat_text:
                category = "0"
            else:
                category = cat_text
        
        # Extract zip file link
        zip_match = re.search(r'href="([^"]+tournaments/[^"]+\.zip)"', row_content)
        zip_file = zip_match.group(1) if zip_match else ""
        
        rows.append({
            'name': name,
            'start_date': start_date,
            'end_date': end_date,
            'players': players,
            'games': games,
            'elo': elo,
            'category': category,
            'zip_file': zip_file,
            'html': f'<tr data-elo="{elo}">{row_content}</tr>'
        })
    
    return rows

def update_tournaments_html(tournament_name, start_date, end_date, players, games, avg_elo, category, zip_file):
    """Update tournaments.html with new tournament entry in chronological order"""
    try:
        # Parse dates for display
        start_display = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:8]}"
        end_display = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:8]}"
        
        # Format event name for display
        display_name = tournament_name.replace('-', ' ').replace('_', ' ')
        words = display_name.split()
        capitalized_words = []
        
        for i, word in enumerate(words):
            if i == 0:
                # Keep ordinal numbers lowercase (1st, 2nd, etc.)
                if re.match(r'^\d+(st|nd|rd|th)$', word, re.IGNORECASE):
                    capitalized_words.append(word.lower())
                else:
                    capitalized_words.append(word.capitalize())
            else:
                # Handle common chess terms
                if word.lower() in ['ch', 'championship', 'cup', 'open', 'classic', 'tournament']:
                    capitalized_words.append(word.capitalize())
                else:
                    # Capitalize other words
                    capitalized_words.append(word.capitalize())
        
        display_name = ' '.join(capitalized_words)
        
        # Create category badge
        if category > 0:
            category_badge = f'<span class="cat-badge">{category}</span>'
        else:
            category_badge = '<span class="cat-badge">-</span>'
        
        # Create new table row
        new_row = f'''
        <tr data-elo="{avg_elo}">
            <td style="font-weight: 500;">{display_name}</td>
            <td style="white-space: nowrap;">{start_display}</td>
            <td style="white-space: nowrap;">{end_display}</td>
            <td style="text-align: center;">{players}</td>
            <td style="text-align: center;">{games}</td>
            <td style="font-family: monospace;">{avg_elo}</td>
            <td class="cat-cell">{category_badge}</td>
            <td style="text-align: right;">
                <a href="{zip_file}" class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;">
                    <span class="material-icons" style="font-size: 1.1em; vertical-align: text-bottom; margin-right: 4px;">cloud_download</span>ZIP
                </a>
            </td>
        </tr>'''
        
        # Read current tournaments.html
        print(f"  Reading tournaments.html from {TOURNAMENTS_HTML_PATH}")
        with open(TOURNAMENTS_HTML_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse existing rows
        existing_rows = parse_existing_tournament_rows(content)
        print(f"  Found {len(existing_rows)} existing tournament rows")
        
        # Create new row object
        new_row_obj = {
            'name': display_name,
            'start_date': start_display,
            'end_date': end_display,
            'players': str(players),
            'games': str(games),
            'elo': str(avg_elo),
            'category': str(category) if category > 0 else "0",
            'zip_file': zip_file,
            'html': new_row.strip()
        }
        
        # Add new row to list
        all_rows = existing_rows + [new_row_obj]
        
        # Sort by start date (chronological order)
        all_rows.sort(key=lambda x: x['start_date'])
        
        # Rebuild tbody content
        new_tbody = ""
        for row in all_rows:
            new_tbody += "        " + row['html'] + "\n"
        
        # Replace the tbody section
        new_content = re.sub(
            r'<tbody>.*?</tbody>',
            f'<tbody>\n{new_tbody}        </tbody>',
            content,
            flags=re.DOTALL
        )
        
        # Update tour count
        tour_count = len(all_rows)
        new_content = re.sub(
            r'<span class="stats" id="tourCount">.*?</span>',
            f'<span class="stats" id="tourCount">{tour_count} tournaments</span>',
            new_content
        )
        
        # Write updated content
        with open(TOURNAMENTS_HTML_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"  Updated tournaments.html with {tour_count} tournaments (sorted chronologically)")
        return True
            
    except Exception as e:
        print(f"Error updating tournaments.html: {e}")
        import traceback
        traceback.print_exc()
        return False

def process_tournament(input_file, event_name, skip_cleanup=False):
    """
    Main function to process a tournament
    """
    print(f"\n{'='*60}")
    print(f"Processing tournament: {event_name}")
    print(f"{'='*60}\n")
    
    # Check if pgn-extract exists
    if not os.path.exists(PGN_EXTRACT_PATH):
        print(f"Error: pgn-extract.exe not found at {PGN_EXTRACT_PATH}")
        return False
    
    # Check if roster.txt exists
    if not os.path.exists(ROSTER_PATH):
        print(f"Error: roster.txt not found at {ROSTER_PATH}")
        return False
    
    # Store original directory
    original_dir = os.getcwd()
    
    try:
        # Step 1: Read and clean the input PGN (remove GameId)
        print("Step 1: Cleaning PGN file (removing GameId tags)...")
        
        # Get absolute path to input file
        if not os.path.isabs(input_file):
            input_file = os.path.join(original_dir, input_file)
        
        with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        cleaned_content = remove_gameid_tags(content)
        
        # Save cleaned version in base directory
        temp_file = os.path.join(BASE_DIR, f"temp_{event_name.replace(' ', '_').replace('-', '_')}.pgn")
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write(cleaned_content)
        print(f"  Created temporary cleaned file: {temp_file}")
        
        # Step 2: Run pgn-extract
        print("\nStep 2: Running pgn-extract...")
        final_pgn = os.path.join(BASE_DIR, f"{event_name.replace(' ', '_').replace('-', '_')}.pgn")
        if not run_pgn_extract(temp_file, final_pgn):
            print("  Failed to run pgn-extract")
            if os.path.exists(temp_file):
                os.remove(temp_file)
            return False
        
        # Step 3: Extract tournament dates
        print("\nStep 3: Extracting tournament dates...")
        start_date, end_date = extract_tournament_dates(final_pgn)
        
        if not start_date or not end_date:
            print("  Error: Could not extract dates from PGN.")
            print("  Please check the PGN file for Date tags.")
            
            # Clean up
            if os.path.exists(temp_file):
                os.remove(temp_file)
            if os.path.exists(final_pgn):
                os.remove(final_pgn)
            return False
        
        print(f"  Start date: {start_date}")
        print(f"  End date:   {end_date}")
        
        # Update base name with extracted dates
        base_name = f"{start_date}-{end_date}-{event_name.replace(' ', '-').replace('_', '-')}"
        
        # Rename the final PGN to include dates
        dated_pgn = os.path.join(BASE_DIR, f"{base_name}.pgn")
        if os.path.exists(dated_pgn):
            os.remove(dated_pgn)
        os.rename(final_pgn, dated_pgn)
        final_pgn = dated_pgn
        
        # Step 4: Calculate tournament statistics
        print("\nStep 4: Calculating tournament statistics...")
        players, avg_elo, category, game_count = calculate_tournament_stats(final_pgn)
        
        if players is None or avg_elo is None:
            print("  Failed to calculate statistics")
            return False
        
        print(f"  Players: {players}")
        print(f"  Games: {game_count}")
        print(f"  Average Elo: {avg_elo}")
        print(f"  Category: {category if category > 0 else 'Below Category 1'}")
        
        # Step 5: Generate crosstable
        print("\nStep 5: Generating crosstable HTML...")
        html_file = os.path.join(BASE_DIR, f"{base_name}.html")
        
        # Run generate_crosstable as a subprocess
        generate_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate_crosstable.py")
        
        cmd = [sys.executable, generate_script, final_pgn, html_file]
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.dirname(generate_script))
        
        if result.returncode != 0:
            print(f"  Error generating crosstable: {result.stderr}")
            return False
        
        print(f"  Crosstable generated: {html_file}")
        
        # Step 6: Create ZIP file
        print("\nStep 6: Creating ZIP file...")
        zip_filename = f"{base_name}.zip"
        zip_file = os.path.join(TOURNAMENTS_DIR, zip_filename)
        
        # Ensure tournaments directory exists
        os.makedirs(TOURNAMENTS_DIR, exist_ok=True)
        
        try:
            with zipfile.ZipFile(zip_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(final_pgn, os.path.basename(final_pgn))
                zipf.write(html_file, os.path.basename(html_file))
            print(f"  Created ZIP file: {zip_file}")
        except Exception as e:
            print(f"  Error creating ZIP file: {e}")
            return False
        
        # Step 7: Update tournaments.html
        print("\nStep 7: Updating tournaments.html...")
        # Use relative path for HTML link
        zip_rel_path = f"tournaments/{zip_filename}"
        if not update_tournaments_html(event_name, start_date, end_date, players, game_count, avg_elo, category, zip_rel_path):
            print("  Warning: Failed to update tournaments.html")
            print("  The tournament was processed successfully, but you'll need to manually update tournaments.html")
        
        # Cleanup
        if not skip_cleanup:
            print("\nStep 8: Cleaning up temporary files...")
            cleanup_files = [temp_file, final_pgn, html_file]
            for file in cleanup_files:
                if os.path.exists(file):
                    os.remove(file)
                    print(f"  Removed: {file}")
        
        print(f"\n{'='*60}")
        print("Tournament processing completed successfully!")
        print(f"Tournament: {event_name}")
        print(f"Dates: {start_date} to {end_date}")
        print(f"Players: {players}, Games: {game_count}, Avg Elo: {avg_elo}")
        print(f"ZIP file: {zip_file}")
        print(f"{'='*60}")
        
        return True
        
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    parser = argparse.ArgumentParser(
        description='Process chess tournament PGN files and extract actual playing dates',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python process_tournament.py tournament.pgn "fide-world-cup"
    - Automatically extracts dates from PGN and processes tournament
    
  python process_tournament.py tournament.pgn "1st-norway-chess" --no-cleanup
    - Processes tournament and keeps intermediate files for debugging
    
Note: The script automatically extracts dates from PGN Date tags.
      Make sure BASE_DIR in the script points to your chessnerd directory.
        """
    )
    
    parser.add_argument('input_file', help='Input PGN file (with ChessBase GameId tags)')
    parser.add_argument('event_name', help='Event name (use hyphens or spaces, e.g., "1st-world-ch" or "1st World Ch")')
    parser.add_argument('--no-cleanup', action='store_true', help='Keep intermediate files for debugging')
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input_file):
        # Try with current directory
        alt_path = os.path.join(os.getcwd(), args.input_file)
        if os.path.exists(alt_path):
            args.input_file = alt_path
        else:
            print(f"Error: Input file not found: {args.input_file}")
            return
    
    # Process the tournament
    success = process_tournament(
        args.input_file,
        args.event_name,
        skip_cleanup=args.no_cleanup
    )
    
    if not success:
        print("\nTournament processing failed. Check errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()