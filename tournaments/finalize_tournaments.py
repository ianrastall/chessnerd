import sys
import os
import re
import zipfile
import shutil
import argparse

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
PROJECT_DIR = r"D:\GitHub\chessnerd"

# Paths
REVIEW_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_REVIEW")
TOURNAMENTS_HTML_PATH = os.path.join(PROJECT_DIR, "tournaments.html")
FINAL_ZIP_DIR = os.path.join(PROJECT_DIR, "tournaments")

# ---------------------------------------------------------

def get_event_name_from_pgn(pgn_path):
    """Reads the first [Event] tag to get the pretty display name."""
    with open(pgn_path, 'r', encoding='utf-8', errors='ignore') as f:
        # Read first few lines only
        for _ in range(20):
            line = f.readline()
            match = re.search(r'\[Event\s+"([^"]+)"\]', line)
            if match:
                return match.group(1)
    return "Unknown Tournament"

def calculate_stats(pgn_file):
    """Recalculates stats from the vetted PGN."""
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

        if not players: return 0, 0, 0, game_count

        ratings = list(players.values())
        avg_elo = int(sum(ratings) / len(ratings))
        category = 0
        if avg_elo >= 2251:
            category = int((avg_elo - 2251) // 25 + 1)
        return len(players), avg_elo, category, game_count
    except:
        return 0, 0, 0, 0

def parse_filename_dates(filename):
    # Expects: YYYYMMDD-YYYYMMDD-slug.pgn
    parts = filename.split('-')
    if len(parts) >= 2:
        return parts[0], parts[1]
    return "00000000", "00000000"

def format_display_name(raw_name):
    # Capitalize and fix ordinals
    display = raw_name.replace('-', ' ').title()
    display = re.sub(r'(\d+)(St|Nd|Rd|Th)', lambda m: m.group(1) + m.group(2).lower(), display)
    return display

def parse_existing_rows(html_content):
    # Extracts existing rows to a list so we can sort them
    row_pattern = re.compile(r'(<tr data-elo="\d+">.*?</tr>)', re.DOTALL)
    matches = row_pattern.findall(html_content)
    parsed_rows = []
    for full_row in matches:
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', full_row)
        start_date = date_match.group(1) if date_match else "0000-00-00"
        parsed_rows.append({'date': start_date, 'html': full_row})
    return parsed_rows

def bulk_update_html(new_entries):
    """
    new_entries: list of dicts {event_name, start, end, players, games, avg_elo, category, zip_rel}
    """
    print(f"  Reading {TOURNAMENTS_HTML_PATH}...")
    with open(TOURNAMENTS_HTML_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    tbody_start = content.find('<tbody>')
    tbody_end = content.find('</tbody>')
    if tbody_start == -1:
        print("Error: Could not find <tbody> tag.")
        return

    # 1. Parse existing
    existing_table_content = content[tbody_start+7:tbody_end]
    rows = parse_existing_rows(existing_table_content)
    
    # 2. Build new rows
    print(f"  Adding {len(new_entries)} new tournaments...")
    for entry in new_entries:
        s_date = entry['start']
        e_date = entry['end']
        
        # Format dates for display (YYYY-MM-DD)
        s_fmt = f"{s_date[:4]}-{s_date[4:6]}-{s_date[6:8]}"
        e_fmt = f"{e_date[:4]}-{e_date[4:6]}-{e_date[6:8]}"
        
        cat_cell = str(entry['category']) if entry['category'] > 0 else ""
        display_name = format_display_name(entry['event_name'])
        
        row_html = f'''    <tr data-elo="{entry['avg_elo']}">
        <td style="font-weight: 500;">{display_name}</td>
        <td style="white-space: nowrap;">{s_fmt}</td>
        <td style="white-space: nowrap;">{e_fmt}</td>
        <td style="text-align: center;">{entry['players']}</td>
        <td style="text-align: center;">{entry['games']}</td>
        <td style="font-family: monospace;">{entry['avg_elo']}</td>
        <td class="cat-cell">{cat_cell}</td>
        <td style="text-align: right;">
            <a href="{entry['zip_rel']}" class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;">
                <span class="material-icons" style="font-size: 1.1em; vertical-align: text-bottom; margin-right: 4px;">cloud_download</span>ZIP
            </a>
        </td>
    </tr>'''
        
        rows.append({'date': s_fmt, 'html': row_html})

    # 3. Sort Everything
    rows.sort(key=lambda x: x['date'])
    
    # 4. Write back
    new_tbody_inner = "\n".join([r['html'] for r in rows])
    new_content = content[:tbody_start+7] + "\n" + new_tbody_inner + "\n    " + content[tbody_end:]

    # Update tour count if exists
    total_tours = len(rows)
    new_content = re.sub(
        r'<span class="stats" id="tourCount">.*?</span>',
        f'<span class="stats" id="tourCount">{total_tours} tournaments</span>',
        new_content
    )

    with open(TOURNAMENTS_HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("  HTML Master File Updated Successfully.")

def main():
    if not os.path.exists(REVIEW_DIR):
        print(f"Error: Review directory not found: {REVIEW_DIR}")
        return

    pgn_files = [f for f in os.listdir(REVIEW_DIR) if f.endswith('.pgn')]
    if not pgn_files:
        print("No PGN files found in _REVIEW folder.")
        return

    print(f"Found {len(pgn_files)} tournaments to finalize.")
    
    new_entries = []
    processed_files = []

    for pgn_file in pgn_files:
        base_name = os.path.splitext(pgn_file)[0] # e.g. 20251206-20251207-london-chess
        html_file = base_name + ".html"
        
        pgn_path = os.path.join(REVIEW_DIR, pgn_file)
        html_path = os.path.join(REVIEW_DIR, html_file)

        if not os.path.exists(html_path):
            print(f"Skipping {pgn_file}: Missing corresponding HTML file.")
            continue

        print(f"Finalizing: {base_name}")

        # 1. Gather Metadata
        start, end = parse_filename_dates(base_name)
        event_name = get_event_name_from_pgn(pgn_path)
        players, avg_elo, category, games = calculate_stats(pgn_path)

        # 2. Create Zip in Production Folder
        zip_filename = base_name + ".zip"
        zip_dest = os.path.join(FINAL_ZIP_DIR, zip_filename)
        
        if not os.path.exists(FINAL_ZIP_DIR): os.makedirs(FINAL_ZIP_DIR)

        with zipfile.ZipFile(zip_dest, 'w', zipfile.ZIP_DEFLATED) as z:
            z.write(pgn_path, pgn_file)
            z.write(html_path, html_file)
        
        print(f"  -> Zipped to: tournaments/{zip_filename}")

        # 3. Queue for HTML Update
        new_entries.append({
            'event_name': event_name,
            'start': start,
            'end': end,
            'players': players,
            'games': games,
            'avg_elo': avg_elo,
            'category': category,
            'zip_rel': f"tournaments/{zip_filename}"
        })
        
        processed_files.append(pgn_path)
        processed_files.append(html_path)

    # 4. Update HTML Table
    if new_entries:
        bulk_update_html(new_entries)
    
    # 5. Cleanup
    print("\nProcessing complete.")
    choice = input("Do you want to delete the finalized files from _REVIEW? (y/n): ").lower()
    if choice == 'y':
        for f in processed_files:
            try:
                os.remove(f)
            except: pass
        print("Review folder cleaned.")

if __name__ == "__main__":
    main()