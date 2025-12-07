import sys
import os
import re
import subprocess
import zipfile
import argparse
from datetime import datetime
from collections import defaultdict

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
PROJECT_DIR = r"D:\GitHub\chessnerd"
TOOLS_DIR = r"D:\chessnerd"

PGN_EXTRACT_PATH = os.path.join(TOOLS_DIR, "pgn-extract.exe")
ROSTER_PATH = os.path.join(TOOLS_DIR, "roster.txt")
TOURNAMENTS_HTML_PATH = os.path.join(PROJECT_DIR, "tournaments.html")
TOURNAMENTS_DIR = os.path.join(PROJECT_DIR, "tournaments")

# ---------------------------------------------------------

def parse_date(date_str):
    if not date_str or date_str.strip() in ["????.??.??", "??.??.??", ""]:
        return None
    if '-' in date_str:
        date_str = date_str.split('-')[0].strip()
    date_str = date_str.replace('.', ' ').replace('/', ' ').replace('-', ' ')
    parts = date_str.strip().split()
    if len(parts) < 3: return None
    
    year, month, day = None, None, None
    if len(parts[0]) == 4 and parts[0].isdigit():
        year = parts[0]
        month = parts[1].zfill(2) if parts[1].isdigit() else '01'
        day = parts[2].zfill(2) if parts[2].isdigit() else '01'
    elif len(parts[-1]) == 4 and parts[-1].isdigit():
        year = parts[-1]
        month = parts[1].zfill(2) if parts[1].isdigit() else '01'
        day = parts[0].zfill(2) if parts[0].isdigit() else '01'

    if year and month and day:
        return f"{year}{month}{day}"
    return None

def extract_tournament_dates(pgn_file):
    min_date, max_date = None, None
    try:
        with open(pgn_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        dates = re.findall(r'\[Date\s+"([^"]+)"\]', content)
        valid_dates = []
        for d in dates:
            pd = parse_date(d)
            if pd: valid_dates.append(pd)
        if valid_dates:
            min_date = min(valid_dates)
            max_date = max(valid_dates)
            print(f"  Found {len(valid_dates)} valid dates. Range: {min_date} to {max_date}")
            return min_date, max_date
        return None, None
    except Exception as e:
        print(f"Error extracting dates: {e}")
        return None, None

def remove_gameid_tags(pgn_content):
    lines = pgn_content.split('\n')
    return '\n'.join([line for line in lines if not line.strip().startswith('[GameId')])

def run_pgn_extract(input_file, output_file):
    cmd = [
        PGN_EXTRACT_PATH, input_file, "-R", "roster.txt", 
        "--xroster", "--fixtagstrings", "--fixresulttags", "--nosetuptags",
        "--minmoves", "1", "-e", "-D", "-C", "-V", "-N", "-w", "9999",
        "--plycount", "-o", output_file
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=TOOLS_DIR)
        if result.returncode != 0:
            print(f"  pgn-extract error: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"Error running pgn-extract: {e}")
        return False

def calculate_tournament_stats(pgn_file):
    try:
        players = {} 
        game_count = 0
        with open(pgn_file, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        tag_pattern = re.compile(r'\[(White|Black|WhiteElo|BlackElo|Event)\s+"([^"]+)"\]')
        
        current_white = None; current_black = None
        current_w_elo = None; current_b_elo = None

        for line in lines:
            match = tag_pattern.match(line)
            if match:
                tag, value = match.groups()
                if tag == "Event": game_count += 1
                elif tag == "White": current_white = value
                elif tag == "Black": current_black = value
                elif tag == "WhiteElo": current_w_elo = value
                elif tag == "BlackElo": current_b_elo = value

            if current_white and current_w_elo and current_w_elo.isdigit():
                players[current_white] = int(current_w_elo)
            if current_black and current_b_elo and current_b_elo.isdigit():
                players[current_black] = int(current_b_elo)

        if not players:
            print("  Warning: No players with ratings found.")
            return 0, 0, 0, game_count

        ratings = list(players.values())
        avg_elo = int(sum(ratings) / len(ratings))
        category = 0
        if avg_elo >= 2251:
            category = int((avg_elo - 2251) // 25 + 1)
        return len(players), avg_elo, category, game_count

    except Exception as e:
        print(f"Error stats: {e}")
        return None, None, None, 0

def format_event_name(event_name):
    # Capitalize nicely and fix ordinals (1St -> 1st)
    display_name = event_name.replace('-', ' ').title()
    display_name = re.sub(r'(\d+)(St|Nd|Rd|Th)', lambda m: m.group(1) + m.group(2).lower(), display_name)
    return display_name

def parse_existing_rows(html_content):
    row_pattern = re.compile(r'(<tr data-elo="\d+">.*?</tr>)', re.DOTALL)
    matches = row_pattern.findall(html_content)
    parsed_rows = []
    for full_row in matches:
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', full_row)
        start_date = date_match.group(1) if date_match else "0000-00-00"
        parsed_rows.append({'date': start_date, 'html': full_row})
    return parsed_rows

def update_tournaments_html(event_name, start_date, end_date, players, games, avg_elo, category, zip_rel_path):
    try:
        start_fmt = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:8]}"
        end_fmt = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:8]}"
        display_name = format_event_name(event_name)
        cat_cell = str(category) if category > 0 else ""
        
        new_row_html = f'''    <tr data-elo="{avg_elo}">
        <td style="font-weight: 500;">{display_name}</td>
        <td style="white-space: nowrap;">{start_fmt}</td>
        <td style="white-space: nowrap;">{end_fmt}</td>
        <td style="text-align: center;">{players}</td>
        <td style="text-align: center;">{games}</td>
        <td style="font-family: monospace;">{avg_elo}</td>
        <td class="cat-cell">{cat_cell}</td>
        <td style="text-align: right;">
            <a href="{zip_rel_path}" class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;">
                <span class="material-icons" style="font-size: 1.1em; vertical-align: text-bottom; margin-right: 4px;">cloud_download</span>ZIP
            </a>
        </td>
    </tr>'''

        print(f"  Reading tournaments.html from: {TOURNAMENTS_HTML_PATH}")
        with open(TOURNAMENTS_HTML_PATH, 'r', encoding='utf-8') as f:
            content = f.read()

        tbody_start = content.find('<tbody>')
        tbody_end = content.find('</tbody>')
        
        if tbody_start == -1:
            print("  Error: <tbody> not found in HTML.")
            return False

        existing_table_content = content[tbody_start+7:tbody_end]
        rows = parse_existing_rows(existing_table_content)
        rows.append({'date': start_fmt, 'html': new_row_html})
        rows.sort(key=lambda x: x['date'])
        
        new_tbody_inner = "\n".join([r['html'] for r in rows])
        new_content = content[:tbody_start+7] + "\n" + new_tbody_inner + "\n    " + content[tbody_end:]

        with open(TOURNAMENTS_HTML_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("  Updated tournaments.html (Sorted chronologically)")
        return True
    except Exception as e:
        print(f"Error HTML update: {e}")
        return False

def process_tournament(input_file, event_name, skip_cleanup):
    print(f"Processing: {event_name}")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if not os.path.isabs(input_file):
        input_file = os.path.join(script_dir, input_file)

    print("Step 1: Cleaning PGN...")
    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        clean_content = remove_gameid_tags(f.read())
    temp_clean = os.path.join(script_dir, "temp_clean.pgn")
    with open(temp_clean, 'w', encoding='utf-8') as f:
        f.write(clean_content)

    print("Step 2: Running pgn-extract...")
    temp_processed = os.path.join(script_dir, "temp_processed.pgn")
    if not run_pgn_extract(temp_clean, temp_processed): return

    print("Step 3: Dates...")
    start, end = extract_tournament_dates(temp_processed)
    if not start:
        print("  Failed to extract dates."); return
    print(f"  Range: {start} - {end}")
    
    # Filename is forced lowercase
    final_base = f"{start}-{end}-{event_name.replace(' ', '-').lower()}"
    final_pgn_path = os.path.join(script_dir, f"{final_base}.pgn")
    if os.path.exists(final_pgn_path): os.remove(final_pgn_path)
    os.rename(temp_processed, final_pgn_path)

    print("Step 4: Stats...")
    players, avg_elo, category, games = calculate_tournament_stats(final_pgn_path)
    if not players: print("  Stats failed."); return
    print(f"  Players: {players}, Elo: {avg_elo}, Cat: {category}, Games: {games}")

    print("Step 5: HTML Crosstable...")
    final_html_path = os.path.join(script_dir, f"{final_base}.html")
    gen_script = os.path.join(script_dir, "generate_crosstable.py")
    
    # Calculate nice title to pass to generator
    report_title = format_event_name(event_name)
    
    # Pass 3 arguments: Input PGN, Output HTML, Report Title
    subprocess.run([sys.executable, gen_script, final_pgn_path, final_html_path, report_title], check=True)

    print("Step 6: Zipping...")
    zip_name = f"{final_base}.zip"
    zip_path = os.path.join(TOURNAMENTS_DIR, zip_name)
    if not os.path.exists(TOURNAMENTS_DIR): os.makedirs(TOURNAMENTS_DIR)
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(final_pgn_path, os.path.basename(final_pgn_path))
        z.write(final_html_path, os.path.basename(final_html_path))

    print("Step 7: Updating Master HTML...")
    update_tournaments_html(event_name, start, end, players, games, avg_elo, category, f"tournaments/{zip_name}")

    if not skip_cleanup:
        if os.path.exists(temp_clean): os.remove(temp_clean)
        if os.path.exists(final_pgn_path): os.remove(final_pgn_path)
        if os.path.exists(final_html_path): os.remove(final_html_path)
        print("Cleanup done.")
    print("\nSUCCESS.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('input_file')
    parser.add_argument('event_name')
    parser.add_argument('--no-cleanup', action='store_true')
    args = parser.parse_args()
    process_tournament(args.input_file, args.event_name, args.no_cleanup)

if __name__ == "__main__":
    main()