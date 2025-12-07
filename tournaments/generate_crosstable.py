import re
import sys
import argparse
from collections import defaultdict

def parse_pgn(pgn_text):
    games = []
    # Split by Event tag
    raw_games = re.split(r'\[Event\s+"', pgn_text)
    
    for raw in raw_games:
        if not raw.strip(): continue
        
        # Extract fields
        tags = {
            'White': 'Unknown', 'Black': 'Unknown', 
            'Result': '*', 'Round': '?', 'ECO': ''
        }
        
        for tag in tags:
            match = re.search(rf'\[{tag}\s+"(.*?)"\]', raw)
            if match:
                tags[tag] = match.group(1)
        
        # Clean up Result
        if tags['Result'] not in ['1-0', '0-1', '1/2-1/2']:
            tags['Result'] = '*' 
            
        games.append(tags)
    return games

def get_stats(games):
    stats = defaultdict(lambda: {'points': 0.0, 'games': 0, 'wins': 0, 'losses': 0, 'draws': 0})
    
    for g in games:
        w, b, res = g['White'], g['Black'], g['Result']
        
        stats[w]['games'] += 1
        stats[b]['games'] += 1
        
        if res == '1-0':
            stats[w]['points'] += 1.0
            stats[w]['wins'] += 1
            stats[b]['losses'] += 1
        elif res == '0-1':
            stats[b]['points'] += 1.0
            stats[b]['wins'] += 1
            stats[w]['losses'] += 1
        elif res == '1/2-1/2':
            stats[w]['points'] += 0.5
            stats[b]['points'] += 0.5
            stats[w]['draws'] += 1
            stats[b]['draws'] += 1
            
    player_list = []
    for name, s in stats.items():
        pct = (s['points'] / s['games'] * 100) if s['games'] > 0 else 0
        player_list.append({
            'name': name,
            'points': s['points'],
            'games': s['games'],
            'pct': pct,
            'wins': s['wins'],
            'losses': s['losses'],
            'draws': s['draws']
        })
        
    return sorted(player_list, key=lambda x: x['points'], reverse=True)

def group_by_round(games):
    rounds = defaultdict(list)
    for g in games:
        r_str = g['Round']
        main_round = "Unknown"
        
        if r_str and r_str != "?":
            match = re.match(r'^(\d+)', r_str)
            if match:
                main_round = int(match.group(1))
            else:
                main_round = r_str
        
        rounds[main_round].append(g)
    
    sorted_keys = sorted([k for k in rounds.keys() if isinstance(k, int)]) + \
                  sorted([k for k in rounds.keys() if not isinstance(k, int)])
                  
    return rounds, sorted_keys

def generate_html(player_stats, rounds, round_keys, title):
    DARK_MODE_CSS = """
    <style>
        :root {
            --bg-color: #1e1e1e;
            --card-bg: #252525;
            --text-main: #e0e0e0;
            --text-muted: #a0a0a0;
            --border: #333;
            --highlight: #007acc;
            --win: #4caf50;
            --loss: #f44336;
            --draw: #9e9e9e;
        }
        body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }
        h1, h2 { color: var(--highlight); }
        h2 { border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-top: 40px; }
        table {
            width: 100%;
            border-collapse: collapse;
            background-color: var(--card-bg);
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border); }
        th { background-color: #333; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; }
        tr:hover { background-color: #2a2a2a; }
        .score-cell { font-weight: bold; color: var(--highlight); }
        .win { color: var(--win); font-weight: bold; }
        .loss { color: var(--loss); font-weight: bold; }
        .draw { color: var(--draw); }
        .round-header { background-color: #383838; font-weight: bold; color: #fff; padding: 8px 15px; margin-top: 20px; border-radius: 4px; }
        .game-row {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            background: var(--card-bg);
            border-bottom: 1px solid var(--border);
            align-items: center;
        }
        .game-row:last-child { border-bottom: none; }
        .game-white, .game-black { flex: 1; font-weight: 500; }
        .game-result { flex: 0 0 80px; text-align: center; font-weight: bold; background: #333; padding: 4px; border-radius: 4px; font-size: 0.9em; }
        .game-eco { flex: 0 0 60px; text-align: right; color: var(--text-muted); font-size: 0.8em; }
    </style>
    """
    
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>{title}</title>
        {DARK_MODE_CSS}
    </head>
    <body>
        <h1>{title}</h1>
        
        <h2>Standings</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Points</th>
                    <th>Games</th>
                    <th>%</th>
                    <th>W / D / L</th>
                </tr>
            </thead>
            <tbody>
    """
    
    for i, p in enumerate(player_stats):
        html += f"""
        <tr>
            <td>{i+1}</td>
            <td style="font-weight:bold; color:#fff;">{p['name']}</td>
            <td class="score-cell">{p['points']}</td>
            <td>{p['games']}</td>
            <td>{p['pct']:.1f}%</td>
            <td><span class="win">{p['wins']}</span> / <span class="draw">{p['draws']}</span> / <span class="loss">{p['losses']}</span></td>
        </tr>
        """
        
    html += """
            </tbody>
        </table>
        
        <h2>Round-by-Round Results</h2>
    """
    
    for r_key in round_keys:
        display_round = f"Round {r_key}" if isinstance(r_key, int) else r_key
        html += f'<div class="round-header">{display_round}</div>'
        html += '<div style="border: 1px solid var(--border); border-radius: 4px; overflow: hidden; margin-bottom: 15px;">'
        
        for g in rounds[r_key]:
            res_class = "draw"
            if g['Result'] == '1-0': res_class = "win"
            elif g['Result'] == '0-1': res_class = "loss"
            
            w_style = "color: var(--win)" if g['Result'] == '1-0' else ""
            b_style = "color: var(--win)" if g['Result'] == '0-1' else ""
            
            html += f"""
            <div class="game-row">
                <div class="game-white" style="{w_style}">{g['White']}</div>
                <div class="game-result {res_class}">{g['Result']}</div>
                <div class="game-black" style="text-align:right; {b_style}">{g['Black']}</div>
                <div class="game-eco">{g['ECO']}</div>
            </div>
            """
        html += '</div>'

    html += """
    </body>
    </html>
    """
    return html

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_crosstable.py <input.pgn> <output.html> [Title]")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    # Check if Title argument is provided, otherwise default to filename
    report_title = sys.argv[3] if len(sys.argv) > 3 else f"Tournament Report: {input_file}"
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            pgn_data = f.read()
            
        games = parse_pgn(pgn_data)
        stats = get_stats(games)
        rounds, sorted_keys = group_by_round(games)
        
        html = generate_html(stats, rounds, sorted_keys, report_title)
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(html)
            
        print(f"Report generated: {output_file}")
        
    except FileNotFoundError:
        print(f"Error: Could not find '{input_file}'.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()