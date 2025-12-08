import requests
import json
import time
import os

# --- CONFIGURATION ---
TITLES = ['GM', 'WGM', 'IM', 'WIM', 'FM', 'WFM', 'NM', 'WNM', 'CM', 'WCM']
OUTPUT_FILE = "titled-players.json"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"

def safe_request(url, retries=3):
    """Fetch URL with timeout and retries."""
    for i in range(retries):
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                print(f"  [!] Rate limit hit. Sleeping 10s...")
                time.sleep(10)
        except requests.exceptions.RequestException:
            time.sleep(2)
    return None

def get_player_data(username):
    data = {
        "username": username,
        "name": "",        # New Field
        "avatar": "",      # New Field
        "country": "??",
        "rapid": 0,
        "blitz": 0,
        "bullet": 0,
        "status": "inactive"
    }
    
    # 1. Get Stats
    stats = safe_request(f"https://api.chess.com/pub/player/{username}/stats")
    if stats:
        data['rapid'] = stats.get('chess_rapid', {}).get('last', {}).get('rating', 0)
        data['blitz'] = stats.get('chess_blitz', {}).get('last', {}).get('rating', 0)
        data['bullet'] = stats.get('chess_bullet', {}).get('last', {}).get('rating', 0)

    # 2. Get Profile
    profile = safe_request(f"https://api.chess.com/pub/player/{username}")
    if profile:
        # Basic Info
        data['name'] = profile.get('name', '')
        data['avatar'] = profile.get('avatar', '') # URL to image
        
        # Country
        country_url = profile.get('country', '')
        if country_url:
            data['country'] = country_url.split('/')[-1].upper()
        
        # Status Mapping
        raw_status = profile.get('status', 'closed')
        active_statuses = ['basic', 'premium', 'staff', 'gold', 'platinum', 'diamond']
        data['status'] = 'active' if raw_status in active_statuses else 'inactive'
            
    return data

def save_db(data):
    with open(OUTPUT_FILE, "w", encoding='utf-8') as f:
        json.dump(data, f)

# --- MAIN EXECUTION ---
full_database = []
processed_usernames = set()

# Resume capability
if os.path.exists(OUTPUT_FILE):
    try:
        with open(OUTPUT_FILE, "r", encoding='utf-8') as f:
            full_database = json.load(f)
            for p in full_database:
                processed_usernames.add(p['username'])
        print(f"RESUMING: Loaded {len(full_database)} players.")
    except:
        print("Starting fresh.")

print("Phase 1: Fetching master list...")
username_map = {} 

for title in TITLES:
    print(f"  Fetching {title}...")
    data = safe_request(f"https://api.chess.com/pub/titled/{title}")
    if data and 'players' in data:
        for p in data['players']:
            if p not in processed_usernames:
                username_map[p] = title

total_new = len(username_map)
if total_new == 0:
    print("All players up to date.")
    exit()

print(f"Phase 2: Fetching details for {total_new} NEW players...")
count = 0

for user, title in username_map.items():
    player_info = get_player_data(user)
    player_info['title'] = title
    
    full_database.append(player_info)
    
    count += 1
    if count % 50 == 0: print(f"  Processed {count}/{total_new}...")
    if count % 500 == 0: save_db(full_database)
    
    time.sleep(0.15) 

save_db(full_database)
print("Done!")