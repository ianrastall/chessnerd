import pandas as pd
import json
import re

def generate_engine_json():
    # --- CONFIGURATION ---
    FILE_LIST = "data/rwbc.xlsx"
    FILE_RATINGS = "data/rwbc-ratings.xlsx"
    OUTPUT_FILE = "data/engines.json"  # Outputting directly to your data folder

    print("Loading Excel files... (This takes a moment)")

    # 1. LOAD ENGINE LIST
    try:
        df_list = pd.read_excel(FILE_LIST, sheet_name=0, header=1, engine='openpyxl')
    except FileNotFoundError:
        print(f"Error: Could not find {FILE_LIST}")
        return

    # Clean column names
    df_list.columns = [str(c).replace('\n', ' ').strip() for c in df_list.columns]
    
    col_name = "Name (color description s. TOC)"
    col_link = "Web/Download"
    col_lang = "PL"
    col_prot = "Prot"
    col_ver = "LR/LV (dev)"
    col_date_first = "Y-M-D FR"
    col_date_last = "YM-LV"

    # 2. LOAD RATINGS
    try:
        # Scan for header row
        df_temp = pd.read_excel(FILE_RATINGS, sheet_name=0, header=None, engine='openpyxl')
        start_row = 0
        for idx, row in df_temp.iterrows():
            row_str = str(row.values).upper()
            if "PLAYER" in row_str and "RATING" in row_str:
                start_row = idx
                break
        
        df_ratings = pd.read_excel(FILE_RATINGS, sheet_name=0, header=start_row, engine='openpyxl')
    except FileNotFoundError:
        print(f"Error: Could not find {FILE_RATINGS}")
        return

    # Clean Ratings
    valid_cols = [c for c in df_ratings.columns if "PLAYER" in str(c).upper() or "RATING" in str(c).upper()]
    df_ratings = df_ratings[valid_cols].iloc[:, :2] 
    df_ratings.columns = ['Player', 'Rating']
    df_ratings = df_ratings.dropna(subset=['Player', 'Rating'])
    
    # Sort Ratings
    df_ratings['Rating'] = pd.to_numeric(df_ratings['Rating'], errors='coerce')
    df_ratings = df_ratings.sort_values(by='Rating', ascending=False)
    ratings_list = df_ratings.to_dict('records') 

    # 3. PROCESS DATA
    output_data = []
    print(f"Processing {len(df_list)} engines...")

    for _, row in df_list.iterrows():
        # Get Name
        raw_name = str(row.get(col_name, ''))
        if pd.isna(raw_name) or raw_name == 'nan' or raw_name.strip() == '':
            continue
        
        name = raw_name.strip()

        # --- LINK HANDLING ---
        # Split by newline to handle multiple links, but we only keep the first one
        # to ensure compatibility with your javascript (e.link)
        raw_link = str(row.get(col_link, ''))
        primary_link = "#"
        if pd.notna(raw_link) and raw_link != 'nan':
            links = [l.strip() for l in raw_link.split('\n') if l.strip()]
            if links:
                primary_link = links[0]

        # Helper for other fields
        def get_val(col):
            val = row.get(col)
            return str(val).strip() if pd.notna(val) and str(val) != 'nan' else None

        def get_date(col):
            val = row.get(col)
            if isinstance(val, pd.Timestamp):
                return val.strftime('%Y-%m')
            val = str(val).strip()
            return val[:7] if len(val) >= 7 else None

        lang = get_val(col_lang)
        protocol = get_val(col_prot)
        ver = get_val(col_ver)
        d_first = get_date(col_date_first)
        d_last = get_date(col_date_last)

        # --- MATCH RATING ---
        rating_val = None
        safe_name = re.escape(name)
        pattern = re.compile(rf"^{safe_name}(\s|$)", re.IGNORECASE)

        for r_entry in ratings_list:
            r_player = str(r_entry['Player'])
            if pattern.match(r_player):
                r_num = r_entry['Rating']
                if pd.notna(r_num):
                    rating_val = str(int(round(r_num)))
                break
        
        # Build Object
        engine_obj = {
            "name": name,
            "link": primary_link,
            "lang": lang,
            "protocol": protocol,
            "d_first": d_first,
            "d_last": d_last,
            "ver": ver,
            "rating": rating_val
        }
        output_data.append(engine_obj)

    # 4. WRITE JSON
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=4)

    print(f"Success! Generated {OUTPUT_FILE} with {len(output_data)} engines.")

if __name__ == "__main__":
    generate_engine_json()