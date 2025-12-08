import sys
import os
import glob
import zipfile
import subprocess
import shutil

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
PROJECT_DIR = r"D:\GitHub\chessnerd"
TOOLS_DIR = r"D:\chessnerd"

# CORRECTED: Zips are in the same folder as this script (D:\GitHub\chessnerd\tournaments)
ZIPS_DIR = os.path.join(PROJECT_DIR, "tournaments")

# Tool Paths
PGN_EXTRACT_PATH = os.path.join(TOOLS_DIR, "pgn-extract.exe")

# ---------------------------------------------------------

def reorder_pgn(pgn_path):
    """Runs pgn-extract to order tags strictly using roster.txt"""
    temp_polished = pgn_path + ".polished"
    
    # Command strictly for reordering tags
    cmd = [
        PGN_EXTRACT_PATH, pgn_path,
        "-R", "roster.txt", 
        "--xroster", 
        "-w", "9999",
        "-o", temp_polished
    ]
    
    try:
        # Run inside TOOLS_DIR so it finds roster.txt
        subprocess.run(cmd, capture_output=True, cwd=TOOLS_DIR, check=True)
        
        # Overwrite original with polished version
        shutil.move(temp_polished, pgn_path)
        return True
    except subprocess.CalledProcessError as e:
        print(f"    Error polishing tags: {e}")
        if os.path.exists(temp_polished): os.remove(temp_polished)
        return False

def process_zip(zip_path):
    zip_name = os.path.basename(zip_path)
    print(f"Processing: {zip_name}")
    
    # Create temp extraction folder
    extract_dir = os.path.join(ZIPS_DIR, "_temp_" + zip_name.replace(".zip", ""))
    if os.path.exists(extract_dir): shutil.rmtree(extract_dir)
    os.makedirs(extract_dir)
    
    try:
        # 1. Extract
        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(extract_dir)
            
        # 2. Find PGN
        pgn_files = glob.glob(os.path.join(extract_dir, "*.pgn"))
        if not pgn_files:
            print("    Skipping: No PGN found inside zip.")
            return

        pgn_file = pgn_files[0] # Assume one PGN per tournament zip
        
        # 3. Polish PGN
        if reorder_pgn(pgn_file):
            print("    Tags reordered successfully.")
            
            # 4. Re-Zip
            # We recreate the zip file from scratch with the contents of extract_dir
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
                for root, dirs, files in os.walk(extract_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Add file to zip with simple filename (flat structure)
                        z.write(file_path, file)
            print("    Zip updated.")
        else:
            print("    Failed to reorder tags. Zip untouched.")

    finally:
        # Cleanup temp folder
        if os.path.exists(extract_dir):
            try:
                shutil.rmtree(extract_dir)
            except:
                print(f"    Warning: Could not delete temp folder {extract_dir}")

def main():
    if not os.path.exists(ZIPS_DIR):
        print(f"Error: Directory not found: {ZIPS_DIR}")
        return

    # Get all zips
    zip_files = glob.glob(os.path.join(ZIPS_DIR, "*.zip"))
    
    if not zip_files:
        print(f"No zip files found in {ZIPS_DIR}")
        return

    print(f"Found {len(zip_files)} zip files in {ZIPS_DIR}")
    print("Starting tag reordering process...\n")
    
    for zip_file in zip_files:
        process_zip(zip_file)
        
    print("\nAll done.")

if __name__ == "__main__":
    main()