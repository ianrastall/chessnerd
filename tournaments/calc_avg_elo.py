import re
import sys
import statistics

def calculate_tournament_elo(pgn_file):
    """
    Parses a PGN file to find unique players and their ratings,
    then calculates the tournament average.
    """
    players = {}  # Format: {'Player Name': Rating}
    
    # Regex to find tags like [White "Name"] and [WhiteElo "2700"]
    # We look for both White and Black players
    tag_regex = re.compile(r'\[(White|Black|WhiteElo|BlackElo)\s+"([^"]+)"\]')
    
    current_white = None
    current_black = None
    current_white_elo = None
    current_black_elo = None

    print(f"Reading {pgn_file}...")
    
    try:
        with open(pgn_file, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                match = tag_regex.match(line)
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
                
                # If we encounter a blank line or a move, it likely means header is done for this game.
                # However, usually we just store data as we find it.
                # The safest way is to store the Elo when we have both Name and Elo.
                
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

    except FileNotFoundError:
        print("Error: File not found.")
        return

    # --- Results ---
    if not players:
        print("No players with ratings found in the PGN.")
        return

    ratings = list(players.values())
    avg_elo = sum(ratings) / len(ratings)
    
    # FIDE Category Calculation
    # Category 1 = 2251-2275. Formula: (Avg - 2251) / 25 + 1
    category = "Uncategorized"
    if avg_elo >= 2251:
        cat_num = int((avg_elo - 2251) // 25 + 1)
        category = f"Category {cat_num}"

    print("-" * 40)
    print(f"Total Players Found: {len(players)}")
    print(f"Average Elo:         {int(avg_elo)}")
    print(f"Tournament Category: {category}")
    print("-" * 40)
    
    # Optional: Print list of players sorted by rating
    # for p, r in sorted(players.items(), key=lambda item: item[1], reverse=True):
    #     print(f"{r} {p}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python calc_avg_elo.py <filename.pgn>")
    else:
        calculate_tournament_elo(sys.argv[1])