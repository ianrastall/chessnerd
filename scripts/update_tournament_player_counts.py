"""Record roster sizes from the existing, checksum-verified PgnTours ZIPs."""

import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "public/data/tournament-archive"
NS = {"ctml": "urn:ctml:2.0"}


def roster_size(archive: zipfile.ZipFile) -> int:
    for member in archive.namelist():
        if member.endswith(".ctml"):
            root = ET.fromstring(archive.read(member))
            return len(root.findall("ctml:participants/ctml:participant", NS))
    for member in archive.namelist():
        if member.endswith(".html"):
            html = archive.read(member).decode("utf-8")
            standings = re.search(r"<h2>Standings</h2>\s*<table\b.*?<tbody>(.*?)</tbody>", html, re.S)
            if standings:
                return len(re.findall(r"<tr\b", standings[1]))
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pgntours", type=Path, help="Root of the PgnTours checkout")
    args = parser.parse_args()

    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    counts = {}
    for entry in manifest:
        path = args.pgntours / entry["decade"] / entry["zip"]
        with path.open("rb") as stream:
            sha256 = hashlib.file_digest(stream, "sha256").hexdigest()
        if sha256 != entry["sha256"].lower():
            raise ValueError(f"Checksum does not match the tournament manifest: {path}")
        with zipfile.ZipFile(path) as archive:
            count = roster_size(archive)
        if count:
            counts[sha256] = count
        else:
            print(f"No roster in {path.name}")

    output = DATA / "player-counts.json"
    temp = output.with_suffix(".tmp")
    temp.write_text(json.dumps(counts, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temp.replace(output)
    print(f"Recorded {len(counts)} PgnTours rosters.")


if __name__ == "__main__":
    main()
