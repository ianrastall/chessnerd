import sys
import os
import re
import subprocess
import sqlite3
import glob
from collections import defaultdict

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
PROJECT_DIR = r"D:\GitHub\chessnerd"
TOOLS_DIR = r"D:\chessnerd"

# Helper Scripts & DB
GENERATE_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate_crosstable.py")
DB_PATH_PRIMARY = os.path.join(PROJECT_DIR, "tournaments", "players.db")
DB_PATH_SECONDARY = r"D:\players.db"

# Tools
PGN_EXTRACT_PATH = os.path.join(TOOLS_DIR, "pgn-extract.exe")
ROSTER_PATH = os.path.join(TOOLS_DIR, "roster.txt")

# Output folder for vetting
REVIEW_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_REVIEW")

# ---------------------------------------------------------

def get_db_connection():
    if os.path.exists(DB_PATH_PRIMARY): return sqlite3.connect(DB_PATH_PRIMARY)
    elif os.path.exists(DB_PATH_SECONDARY): return sqlite3.connect(DB_PATH_SECONDARY)
    return None

def parse_date(date_str):
    if not date_str or date_str.strip() in ["????.??.??", "??.??.??", ""]: return None
    if '-' in date_str: date_str = date_str.split('-')[0].strip()
    date_str = date_str.replace('.', ' ').replace('/', ' ').replace('-', ' ')
    parts = date_str.strip().split()
    if len(parts) < 3: return None
    
    year, month, day = None, None, None
    if len(parts[0]) == 4 and parts[0].isdigit():
        year = parts[0]; month = parts[1].zfill(2); day = parts[2].zfill(2)
    elif len(parts[-1]) == 4 and parts[-1].isdigit():
        year = parts[-1]; month = parts[1].zfill(2); day = parts[0].zfill(2)

    if year and month and day and month.isdigit() and day.isdigit():
        return f"{year}{month}{day}"
    return None

def get_event_info(pgn_content):
    """
    Extracts the Event name from the first [Event] tag.
    Returns (event_name, event_slug)
    """
    match = re.search(r'\[Event\s+"([^"]+)"\]', pgn_content)
    if match:
        raw_name = match.group(1)
        # Create a slug: "London Chess Classic" -> "london-chess-classic"
        # Remove chars that aren't alphanumeric, space, or hyphen
        clean = re.sub(r'[^a-zA-Z0-9\s-]', '', raw_name)
        slug = re.sub(r'[\s-]+', '-', clean).lower().strip('-')
        return raw_name, slug
    return "Unknown Tournament", "unknown-tournament"

def extract_dates_from_content(content):
    dates = re.findall(r'\[Date\s+"([^"]+)"\]', content)
    valid_dates = []
    for d in dates:
        pd = parse_date(d)
        if pd: valid_dates.append(pd)
    if valid_dates:
        return min(valid_dates), max(valid_dates)
    return None, None

def normalize_pgn_content(content, start_date):
    """
    Takes PGN content, queries DB, returns Normalized Content.
    Does NOT write to file directly.
    """
    conn = get_db_connection()
    if not conn: return content # Skip if no DB

    cursor = conn.cursor()
    t_year = int(start_date[:4])
    t_month = int(start_date[4:6])
    
    lines = content.splitlines(keepends=True)
    new_lines = []
    name_tag_pattern = re.compile(r'\[(White|Black)\s+"([^"]+)"\]')
    
    current_white_pid = None
    current_black_pid = None
    
    for line in lines:
        match = name_tag_pattern.match(line)
        if match:
            tag, name = match.groups()
            
            # 1. Lookup ID
            cursor.execute("SELECT player_id FROM aliases WHERE alias = ? COLLATE NOCASE", (name,))
            res = cursor.fetchone()
            if not res:
                cursor.execute("SELECT id FROM players WHERE name = ? COLLATE NOCASE", (name,))
                res = cursor.fetchone()
            
            player_id = res[0] if res else None
            canonical_name = name 
            
            if player_id:
                # 2. Canonical Name
                cursor.execute("SELECT name FROM players WHERE id = ?", (player_id,))
                p_res = cursor.fetchone()
                if p_res: canonical_name = p_res[0]

                if tag == "White": current_white_pid = player_id
                else: current_black_pid = player_id
                
                new_lines.append(f'[{tag} "{canonical_name}"]\n')
                
                # 3. Inject Rating
                rating_query = """
                    SELECT value FROM ratings 
                    WHERE player_id = ? AND source = 'fide'
                    AND (year < ? OR (year = ? AND series_index <= ?))
                    ORDER BY year DESC, series_index DESC LIMIT 1
                """
                cursor.execute(rating_query, (player_id, t_year, t_year, t_month))
                r_res = cursor.fetchone()
                if r_res:
                    elo_tag = "WhiteElo" if tag == "White" else "BlackElo"
                    new_lines.append(f'[{elo_tag} "{r_res[0]}"]\n')
            else:
                new_lines.append(line)
        
        elif line.startswith('[WhiteElo') or line.startswith('[BlackElo'):
            # Skip existing Elo tags only if we identified the player (and thus injected a new one)
            # Simpler: just keep them if we didn't identify player. 
            # If we identified player, we already wrote the tag above.
            is_white = line.startswith('[WhiteElo')
            pid = current_white_pid if is_white else current_black_pid
            if not pid:
                new_lines.append(line)
        else:
            new_lines.append(line)

    conn.close()
    return "".join(new_lines)

def process_file(filepath):
    filename = os.path.basename(filepath)
    print(f"\nProcessing: {filename}")
    
    # 1. Read & Clean Tags
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        raw_content = f.read()
    
    # Remove GameId
    lines = raw_content.splitlines()
    clean_lines = [l for l in lines if not l.strip().startswith('[GameId')]
    clean_content = "\n".join(clean_lines)

    # 2. Get Event Name & Slug (Auto-detect)
    event_name, event_slug = get_event_info(clean_content)
    print(f"  Detected Event: {event_name}")

    # 3. Run PGN-Extract (Standardization)
    # We write to a temp file in REVIEW_DIR
    if not os.path.exists(REVIEW_DIR): os.makedirs(REVIEW_DIR)
    temp_in = os.path.join(REVIEW_DIR, "temp_in.pgn")
    temp_out = os.path.join(REVIEW_DIR, "temp_out.pgn")
    
    with open(temp_in, 'w', encoding='utf-8') as f:
        f.write(clean_content)
        
    cmd = [
        PGN_EXTRACT_PATH, temp_in, "-R", "roster.txt", 
        "--xroster", "--fixtagstrings", "--fixresulttags", "--nosetuptags",
        "--minmoves", "1", "-e", "-D", "-C", "-V", "-N", "-w", "9999",
        "--plycount", "-o", temp_out
    ]
    
    try:
        subprocess.run(cmd, capture_output=True, cwd=TOOLS_DIR, check=True)
    except subprocess.CalledProcessError:
        print("  Error: pgn-extract failed.")
        return

    # 4. Extract Dates
    with open(temp_out, 'r', encoding='utf-8') as f:
        extracted_content = f.read()
    
    start, end = extract_dates_from_content(extracted_content)
    if not start:
        print("  Error: Could not determine dates. Skipping.")
        return
    
    print(f"  Dates: {start} - {end}")

    # 5. Normalize (DB Lookup)
    final_content = normalize_pgn_content(extracted_content, start)

    # 6. Save Final PGN
    final_filename = f"{start}-{end}-{event_slug}.pgn"
    final_pgn_path = os.path.join(REVIEW_DIR, final_filename)
    
    with open(final_pgn_path, 'w', encoding='utf-8') as f:
        f.write(final_content)
    
    print(f"  Saved PGN: {final_filename}")

    # 7. Generate HTML Report
    # Title format: "London Chess Classic" (We format the raw event name nicely)
    # Logic copied from previous script for pretty title
    display_title = event_name.replace('-', ' ').title()
    display_title = re.sub(r'(\d+)(St|Nd|Rd|Th)', lambda m: m.group(1) + m.group(2).lower(), display_title)

    final_html_filename = f"{start}-{end}-{event_slug}.html"
    final_html_path = os.path.join(REVIEW_DIR, final_html_filename)
    
    subprocess.run([sys.executable, GENERATE_SCRIPT, final_pgn_path, final_html_path, display_title], check=True)
    print(f"  Saved Report: {final_html_filename}")

    # Cleanup Temps
    if os.path.exists(temp_in): os.remove(temp_in)
    if os.path.exists(temp_out): os.remove(temp_out)

def main():
    # Get all PGNs in current dir
    cwd = os.getcwd()
    pgn_files = glob.glob(os.path.join(cwd, "*.pgn"))
    
    if not pgn_files:
        print("No .pgn files found in the current directory.")
        return

    print(f"Found {len(pgn_files)} PGN files. Processing...")
    print(f"Output folder: {REVIEW_DIR}")
    
    for pgn in pgn_files:
        # Skip files that are already in the REVIEW folder if script is run there
        if REVIEW_DIR in pgn: continue
        process_file(pgn)
        
    print("\nBatch processing complete. Check the '_REVIEW' folder.")

if __name__ == "__main__":
    main()