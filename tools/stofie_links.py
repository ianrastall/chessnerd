import requests
import csv
import json
import time
from bs4 import BeautifulSoup
from datetime import datetime
import os
from collections import defaultdict

# Configuration
GITHUB_TOKEN = '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'
GITHUB_OWNER = 'official-stockfish'
GITHUB_REPO = 'Stockfish'
ABROK_URL = 'https://abrok.eu/stockfish/'

# Output files
COMMITS_FILE = 'stockfish_commits_full.json'
BINARIES_FILE = 'stockfish_binaries_full.csv'
OUTPUT_FILE = 'stockfish_collection.txt'

class StockfishCollector:
    def __init__(self):
        self.headers = {
            'Authorization': f'token {GITHUB_TOKEN}',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Stockfish-Collector/1.0'
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
    def fetch_all_commits(self):
        """Fetch all commits from GitHub API"""
        commits = []
        page = 1
        per_page = 100  # GitHub max per page
        
        print("Fetching commits from GitHub...")
        
        while True:
            url = f'https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/commits'
            params = {'per_page': per_page, 'page': page, 'sha': 'master'}
            
            try:
                response = self.session.get(url, params=params)
                response.raise_for_status()
                page_commits = response.json()
                
                if not page_commits:
                    break
                    
                for commit in page_commits:
                    commit_data = {
                        'sha': commit['sha'],
                        'author_name': commit['commit']['author']['name'],
                        'author_email': commit['commit']['author']['email'],
                        'date': commit['commit']['author']['date'],
                        'message': commit['commit']['message'],
                        'html_url': commit['html_url'],
                        'source_zip': f'https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/archive/{commit["sha"]}.zip',
                        'source_tar': f'https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/archive/{commit["sha"]}.tar.gz'
                    }
                    commits.append(commit_data)
                    
                print(f'  Page {page}: {len(page_commits)} commits')
                page += 1
                time.sleep(0.5)  # Be gentle on GitHub API
                
            except requests.exceptions.RequestException as e:
                print(f"Error fetching commits: {e}")
                break
                
        # Save commits to JSON
        with open(COMMITS_FILE, 'w', encoding='utf-8') as f:
            json.dump(commits, f, indent=2, ensure_ascii=False)
            
        print(f"Saved {len(commits)} commits to {COMMITS_FILE}")
        return commits
        
    def fetch_abrok_binaries(self):
        """Scrape binary builds from abrok.eu"""
        binaries = []
        page = 1
        
        print("Fetching binaries from abrok.eu...")
        
        while True:
            if page == 1:
                url = ABROK_URL
            else:
                url = f'{ABROK_URL}?page={page}'
                
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find all table rows
                rows = soup.find_all('tr')
                if not rows or len(rows) < 2:
                    break
                    
                processed_rows = 0
                for row in rows[1:]:  # Skip header row
                    cols = row.find_all('td')
                    if len(cols) < 2:
                        continue
                        
                    # Left column: Binary links
                    binary_col = cols[0]
                    binary_links = binary_col.find_all('a', href=True)
                    
                    # Right column: Commit info
                    commit_col = cols[1]
                    
                    # Extract commit SHA
                    commit_link = commit_col.find('a', href=True)
                    if commit_link:
                        commit_href = commit_link['href']
                        # Try to extract SHA from URL
                        if '/commit/' in commit_href:
                            sha = commit_href.split('/commit/')[-1]
                            if len(sha) != 40:  # Not a valid SHA
                                # Try alternative extraction
                                sha_match = commit_href.split('/')[-1]
                                if len(sha_match) == 40:
                                    sha = sha_match
                                else:
                                    continue
                        else:
                            continue
                    else:
                        continue
                        
                    # Extract date
                    date_text = ''
                    for text in commit_col.stripped_strings:
                        if text.startswith('Date:'):
                            date_text = text.replace('Date:', '').strip()
                            break
                            
                    # Process each binary link
                    for link in binary_links:
                        binary_url = link['href']
                        if not binary_url.startswith('http'):
                            binary_url = f'https://abrok.eu{binary_url}'
                            
                        binary_data = {
                            'commit_sha': sha,
                            'label': link.text.strip(),
                            'binary_url': binary_url,
                            'date': date_text,
                            'source': 'abrok.eu'
                        }
                        binaries.append(binary_data)
                        
                    processed_rows += 1
                    
                print(f'  Page {page}: {processed_rows} rows')
                
                # Check if we should continue
                if processed_rows == 0:
                    break
                    
                page += 1
                time.sleep(1)  # Be gentle on abrok server
                
            except Exception as e:
                print(f"Error scraping abrok page {page}: {e}")
                break
                
        # Save binaries to CSV
        if binaries:
            with open(BINARIES_FILE, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=binaries[0].keys())
                writer.writeheader()
                writer.writerows(binaries)
                
        print(f"Saved {len(binaries)} binaries to {BINARIES_FILE}")
        return binaries
        
    def fetch_github_artifacts(self, max_pages=10):
        """Fetch GitHub Actions artifacts (optional)"""
        artifacts_by_commit = defaultdict(list)
        page = 1
        
        print("Fetching GitHub artifacts (optional)...")
        
        while page <= max_pages:
            runs_url = f'https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/actions/runs'
            params = {'per_page': 100, 'page': page}
            
            try:
                response = self.session.get(runs_url, params=params)
                response.raise_for_status()
                runs = response.json()['workflow_runs']
                
                if not runs:
                    break
                    
                for run in runs:
                    sha = run['head_sha']
                    
                    # Fetch artifacts for this run
                    artifacts_url = f'https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/actions/runs/{run["id"]}/artifacts'
                    artifacts_response = self.session.get(artifacts_url)
                    
                    if artifacts_response.status_code == 200:
                        artifacts = artifacts_response.json().get('artifacts', [])
                        for artifact in artifacts:
                            artifact_data = {
                                'name': artifact['name'],
                                'url': artifact['archive_download_url'],
                                'size': artifact['size_in_bytes'],
                                'created_at': artifact['created_at'],
                                'run_id': run['id'],
                                'source': 'github_actions'
                            }
                            artifacts_by_commit[sha].append(artifact_data)
                            
                print(f'  Page {page}: {len(runs)} workflow runs')
                page += 1
                time.sleep(0.5)
                
            except Exception as e:
                print(f"Error fetching artifacts page {page}: {e}")
                break
                
        return dict(artifacts_by_commit)
        
    def combine_data(self, commits, binaries, artifacts=None):
        """Combine all data into a structured format"""
        print("Combining data...")
        
        # Create lookup dictionaries
        binaries_by_sha = defaultdict(list)
        for binary in binaries:
            binaries_by_sha[binary['commit_sha']].append(binary)
            
        # Sort commits by date (newest first)
        commits_sorted = sorted(commits, 
                              key=lambda x: x['date'], 
                              reverse=True)
        
        # Generate final output
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("STOCKFISH COMMIT COLLECTION\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n")
            f.write(f"Total commits: {len(commits_sorted)}\n")
            f.write(f"Total binaries: {len(binaries)}\n")
            if artifacts:
                total_artifacts = sum(len(v) for v in artifacts.values())
                f.write(f"Total artifacts: {total_artifacts}\n")
            f.write("=" * 80 + "\n\n")
            
            for idx, commit in enumerate(commits_sorted, 1):
                sha = commit['sha']
                
                f.write(f"COMMIT #{idx}: {sha[:8]}...\n")
                f.write("-" * 60 + "\n")
                f.write(f"Author: {commit['author_name']} <{commit['author_email']}>\n")
                f.write(f"Date: {commit['date']}\n")
                f.write(f"GitHub: {commit['html_url']}\n\n")
                
                # Source code links
                f.write("SOURCE CODE:\n")
                f.write(f"  • ZIP: {commit['source_zip']}\n")
                f.write(f"  • TAR.GZ: {commit['source_tar']}\n\n")
                
                # Abrok binaries
                abrok_binaries = binaries_by_sha.get(sha, [])
                if abrok_binaries:
                    f.write("ABROK.EU BINARIES:\n")
                    for binary in abrok_binaries:
                        f.write(f"  • {binary['label']}: {binary['binary_url']}\n")
                    f.write("\n")
                    
                # GitHub artifacts
                if artifacts and sha in artifacts:
                    f.write("GITHUB ACTIONS ARTIFACTS:\n")
                    for artifact in artifacts[sha]:
                        f.write(f"  • {artifact['name']} ({artifact['size']} bytes): {artifact['url']}\n")
                    f.write("\n")
                    
                # Commit message
                f.write("COMMIT MESSAGE:\n")
                f.write(commit['message'])
                f.write("\n\n")
                f.write("=" * 80 + "\n\n")
                
        print(f"Generated complete collection in {OUTPUT_FILE}")
        
    def generate_summary_csv(self, commits, binaries, artifacts=None):
        """Generate a summary CSV file for quick reference"""
        summary_file = 'stockfish_summary.csv'
        
        with open(summary_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['SHA', 'Date', 'Author', 'Has_Source', 'Abrok_Binaries', 'GitHub_Artifacts', 'GitHub_URL'])
            
            binaries_by_sha = defaultdict(list)
            for binary in binaries:
                binaries_by_sha[binary['commit_sha']].append(binary)
                
            for commit in commits:
                sha = commit['sha']
                has_abrok = len(binaries_by_sha.get(sha, [])) > 0
                has_artifacts = artifacts and sha in artifacts and len(artifacts[sha]) > 0
                
                writer.writerow([
                    sha[:12] + '...',  # Short SHA
                    commit['date'],
                    commit['author_name'],
                    'Yes',  # Always has source
                    'Yes' if has_abrok else 'No',
                    'Yes' if has_artifacts else 'No',
                    commit['html_url']
                ])
                
        print(f"Generated summary CSV: {summary_file}")
        
def main():
    print("Stockfish Collection Builder")
    print("=" * 50)
    
    collector = StockfishCollector()
    
    # Step 1: Fetch commits
    commits = collector.fetch_all_commits()
    
    # Step 2: Fetch binaries from abrok.eu
    binaries = collector.fetch_abrok_binaries()
    
    # Step 3: Optional - Fetch GitHub artifacts
    artifacts = None
    if input("Fetch GitHub Actions artifacts? (y/n): ").lower() == 'y':
        artifacts = collector.fetch_github_artifacts(max_pages=5)
    
    # Step 4: Combine everything
    collector.combine_data(commits, binaries, artifacts)
    
    # Step 5: Generate summary
    collector.generate_summary_csv(commits, binaries, artifacts)
    
    print("\nDone! Files created:")
    print(f"  - {COMMITS_FILE}: Full commit data (JSON)")
    print(f"  - {BINARIES_FILE}: Binary download links (CSV)")
    print(f"  - {OUTPUT_FILE}: Complete human-readable collection")
    print(f"  - stockfish_summary.csv: Quick reference CSV")
    
if __name__ == '__main__':
    main()