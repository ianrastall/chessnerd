"""Build a local SQLite archive from the saved Edo Historical Chess Ratings files."""

import argparse
from contextlib import closing
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
from urllib.parse import unquote, urljoin, urlsplit
import zlib

from lxml import html


ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "http://www.edochess.ca/"
PAGE_PATH = re.compile(r"(players/p|matches/m|tournaments/t|years/y|locations/l)(\d+)\.html")
KINDS = {
    "players/p": "player", "matches/m": "match", "tournaments/t": "tournament",
    "years/y": "year", "locations/l": "location",
}
HEADERS = {
    "player": ("Year", "Rank", "Edo", "Dev.", "Games"),
    "year": ("Rank", "Name", "Edo", "Dev.", "Games"),
    "match": ("Name", "Edo", "Dev.", "Score", "/", "Games"),
}
FIELDS = {
    "Name": "full_name", "Also known as": "also_known_as", "Born": "born",
    "Died": "died", "Place": "place", "Start date": "start_date",
    "End date": "end_date", "Status": "status", "Player page created": "created",
    "Player information updated": "updated", "Match page created": "created",
    "Match information updated": "updated", "Tournament page created": "created",
    "Tournament information updated": "updated",
}
REFERENCE_PAGES = {
    "Refs.Books.html": "Books",
    "Refs.Periodicals.html": "Periodicals",
    "Refs.Web.Sites.html": "Web",
    "Rating.table.notes.html": "Rating notes",
}
TOURNAMENT_SECTIONS = ("Crosstable scores", "Match scores")
CATEGORY = re.compile(r"(?:^|/)Refs\.[^/]+\.html$", re.IGNORECASE)
LEAF_ROWS = html.etree.XPath(".//tr[td or th][not(.//table)]")
HEADINGS = html.etree.XPath(".//font[@size='6' or @size='7']")


def clean(value):
    return " ".join(value.split())


def integer(value):
    return int(value) if re.fullmatch(r"[0-9]+", value) else None


def decimal(value):
    return float(value) if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", value) else None


def deviation(value):
    return integer(value.removeprefix("(").removesuffix(")"))


def local_path(url):
    parts = urlsplit(url)
    if parts.scheme in ("http", "https") and parts.hostname in ("www.edochess.ca", "edochess.ca"):
        return unquote(parts.path.lstrip("/"))
    return None


@lru_cache(maxsize=32768)
def link_target(directory, href):
    base = BASE_URL + directory + "/" if directory else BASE_URL
    url = urljoin(base, href.strip())
    path = local_path(url)
    return url, path, page_key(path) if path else None


def page_key(path):
    match = PAGE_PATH.fullmatch(path)
    if match:
        return KINDS[match[1]], int(match[2])
    return None


def event_id(key):
    return f"{key[0][0]}{key[1]}"


def decode(raw):
    for encoding in ("utf-8", "windows-1252"):
        try:
            return raw.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    return raw.decode("iso-8859-1"), "iso-8859-1"


def read_manifests(source):
    entries = {}
    urls = {}
    filenames = ["players.txt", "years.txt", "locations.txt", "matches.txt"]
    if (source / "tournaments.txt").is_file():
        filenames.append("tournaments.txt")
    for filename in filenames:
        raw = (source / filename).read_bytes()
        entries[filename] = []
        for line_number, line in enumerate(raw.decode("utf-8-sig").splitlines(), 1):
            url = line.strip()
            if not url:
                continue
            path = local_path(url)
            if path is None or not path.startswith(filename.removesuffix(".txt") + "/") or not page_key(path):
                raise ValueError(f"{filename}:{line_number}: unexpected Edo URL {url!r}")
            entries[filename].append((line_number, url, path))
            urls.setdefault(path, url)
    return entries, urls


class Archive:
    def __init__(self, db, files):
        self.db = db
        self.files = files
        self.entities = {}

    def remember(self, key, label=None):
        entity = self.entities.setdefault(key, {})
        if label:
            entity.setdefault("label", label)
        return entity

    def import_file(self, path, raw, source_url):
        file_id = self.files[path]
        key = page_key(path)
        category = REFERENCE_PAGES.get(path)
        title = status = encoding = None
        if key or category:
            decoded, encoding = decode(raw)
            doc = html.fromstring(decoded)
            title = clean(doc.findtext(".//title", ""))
            if title == "Error 404 - Not found":
                status = "http_404"
            elif key and title.startswith("Edo Ratings,") and len(HEADINGS(doc)) == 1:
                status = "edo_page"
            elif category and title.startswith("Edo Ratings - "):
                status = "edo_reference"
            else:
                raise ValueError(f"{path}: unrecognized page title or heading: {title!r}")
        self.db.execute(
            "INSERT INTO source_files VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (file_id, path, source_url, len(raw), hashlib.sha256(raw).hexdigest(),
             zlib.compress(raw), title, status, encoding),
        )
        if status == "edo_page":
            links = self.read_links(doc, key, path, source_url)
            positions = self.import_page(doc, key, file_id, links)
            self.write_links(file_id, links, positions)
        elif status == "edo_reference":
            links = self.read_links(doc, None, path, source_url)
            positions = self.import_reference(doc, file_id, category)
            self.write_links(file_id, links, positions)

    def read_links(self, doc, key, path, source_url):
        directory = path.rpartition("/")[0]
        links = {}
        for node in doc.iter("a", "img", "link"):
            href = node.get("src" if node.tag == "img" else "href")
            if href is None:
                continue
            label = clean(node.text_content()) if node.tag == "a" else node.get("alt")
            # Fragment- and query-only links resolve against the current page.
            if not href.strip() or href.lstrip().startswith(("#", "?")):
                url, target, target_key = urljoin(source_url, href.strip()), path, key
            else:
                url, target, target_key = link_target(directory, href)
            links[node] = (label, href, url, self.files.get(target), target_key)
            if target_key:
                self.remember(target_key, label)
        return links

    def write_row(self, file_id, node, values):
        return self.db.execute(
            "INSERT INTO source_rows(file_id, line_number, cells_json) VALUES (?, ?, ?)",
            (file_id, node.sourceline, json.dumps(values, ensure_ascii=False)),
        ).lastrowid

    def import_reference(self, doc, file_id, category):
        positions = {}
        if category in ("Books", "Rating notes"):
            selector = ".//ol/li" if category == "Books" else ".//h3/following-sibling::ul/li"
            for item in doc.xpath(selector):
                label = clean(item[0].text_content())
                description = clean(item.text_content()).removeprefix(label).strip()
                row_id = self.write_row(file_id, item, (label, description))
                positions[item] = (row_id, 1)
                self.db.execute("INSERT INTO reference_entries VALUES (?, ?, ?, ?, NULL, NULL)",
                                (row_id, category, label.rstrip(":"), description or None))
        else:
            for row in LEAF_ROWS(doc):
                cells = [cell for cell in row if cell.tag in ("td", "th")]
                values = tuple(clean(cell.text_content()) for cell in cells)
                row_id = self.write_row(file_id, row, values)
                for index, cell in enumerate(cells, 1):
                    positions[cell] = (row_id, index)
                if not values[0]:
                    continue
                if category == "Periodicals":
                    label, description, coverage, additional = values
                else:
                    label, description = values
                    label = label.strip("[]")
                    coverage = additional = None
                self.db.execute("INSERT INTO reference_entries VALUES (?, ?, ?, ?, ?, ?)",
                                (row_id, category, label, description or None,
                                 coverage or None, additional or None))
        return positions

    def import_page(self, doc, key, file_id, links):
        kind, _ = key
        entity = self.remember(key)
        entity.update(file_id=file_id, heading=clean(HEADINGS(doc)[0].text_content()))
        if kind == "location":
            for font in doc.iter("font"):
                if font.get("size") == "5":
                    heading = clean(font.text_content())
                    if heading.startswith("Events taking place in "):
                        entity["full_name"] = heading.removeprefix("Events taking place in ")
                        break

        sections = {}
        note_tables = set()
        active_listings = {}
        positions = {}
        tournament_section = None
        result_sets = {}
        for row in LEAF_ROWS(doc):
            cells = [cell for cell in row if cell.tag in ("td", "th")]
            values = tuple(clean(cell.text_content()) for cell in cells)
            row_links = [[links[a] for a in cell.iter("a") if a in links] for cell in cells]
            table = next(row.iterancestors("table"), None)
            if not any(values) and not any(row_links):
                if table in result_sets and result_sets[table][1] is not None:
                    result_set_id, group = result_sets[table]
                    result_sets[table] = (result_set_id, group + 1)
                continue
            row_id = self.write_row(file_id, row, values)
            for index, cell in enumerate(cells, 1):
                positions[cell] = (row_id, index)

            if kind == "tournament":
                if len(values) == 1 and values[0] in TOURNAMENT_SECTIONS:
                    tournament_section = values[0]
                elif values[:6] == HEADERS["match"]:
                    if tournament_section is None:
                        raise ValueError(f"{key}: tournament score table without a section heading")
                    self.db.execute("INSERT INTO tournament_result_sets VALUES (?, ?, ?)",
                                    (row_id, event_id(key), tournament_section))
                    result_sets[table] = (row_id, 1 if tournament_section == "Match scores" else None)
                    tournament_section = None
                    continue
                elif row.get("bgcolor") == "#ffffff":
                    self.import_tournament_result(key, row_id, values, row_links, result_sets.get(table))

            if kind in HEADERS and values == HEADERS[kind]:
                sections[table] = "data"
                continue
            if sections.get(table) == "data":
                if kind in ("player", "year"):
                    self.import_rating(row_id, key, values, row_links)
                elif len(values) == 6 and values[4] == "/":
                    player = linked_number(row_links[0], "player")
                    self.db.execute(
                        "INSERT INTO match_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (row_id, event_id(key), player, values[0], integer(values[1]),
                         deviation(values[2]), decimal(values[3]), decimal(values[5]),
                         values[3], values[5]),
                    )

            if len(values) == 1:
                value = values[0]
                label, _, content = value.partition(":")
                citation_header = any(CATEGORY.search(link[1]) for link in row_links[0])
                if citation_header and value in ("Books", "Periodicals", "Web", "Other"):
                    sections[table] = value
                elif sections.get(table) not in (None, "data"):
                    self.db.execute("INSERT INTO citations VALUES (?, ?, ?, ?)",
                                    (row_id, file_id, sections[table], value))
                elif label in FIELDS and ":" in value:
                    entity[FIELDS[label]] = content.strip() or None
                    if kind in ("match", "tournament") and label == "Place":
                        place_ids = {link[4][1] for link in row_links[0]
                                     if link[4] and link[4][0] == "location"}
                        self.db.executemany("INSERT INTO event_places VALUES (?, ?, ?)",
                                            ((event_id(key), place, row_id) for place in sorted(place_ids)))
                elif label == "Notes" and ":" in value:
                    note_tables.add(table)
                    if content.strip():
                        self.db.execute("INSERT INTO page_notes VALUES (?, ?, ?)",
                                        (row_id, file_id, content.strip()))
                elif table in note_tables:
                    self.db.execute("INSERT INTO page_notes VALUES (?, ?, ?)", (row_id, file_id, value))

            if kind in ("player", "year", "location"):
                self.import_listing(key, row_id, values, row_links, table, active_listings)
        return positions

    def write_links(self, file_id, links, positions):
        link_rows = []
        for node, (label, href, url, target_file, _) in links.items():
            cell = next((ancestor for ancestor in node.iterancestors("td", "th", "li")
                         if ancestor in positions), None)
            row_id, cell_number = positions.get(cell, (None, None))
            link_rows.append((file_id, row_id, cell_number, node.sourceline, node.tag,
                              label or None, href, url, target_file))
        self.db.executemany(
            "INSERT INTO source_links(file_id, row_id, cell_number, line_number, tag, label, "
            "target_as_written, target_url, target_file_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            link_rows,
        )

    def import_tournament_result(self, key, row_id, values, links, result_set):
        if result_set is None or len(values) not in (6, 7) or values[4] != "/":
            raise ValueError(f"{key}: unexpected tournament result {values}")
        score, games = decimal(values[3]), decimal(values[5])
        if score is None or games is None:
            raise ValueError(f"{key}: invalid tournament score or games {values}")
        result_set_id, group = result_set
        class_text = values[6] if len(values) == 7 else ""
        self.db.execute(
            "INSERT INTO tournament_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (row_id, result_set_id, group, linked_number(links[0], "player"), values[0],
             integer(values[1]), deviation(values[2]), score, games, values[3], values[5],
             class_text or None),
        )

    def import_rating(self, row_id, key, values, links):
        kind, number = key
        if len(values) != 5:
            raise ValueError(f"{key}: unexpected rating row {values}")
        if kind == "player":
            player, year, rank = number, linked_number(links[0], "year"), integer(values[1])
        else:
            player, year, rank = linked_number(links[1], "player"), number, integer(values[0])
        rating, dev, games = integer(values[2]), deviation(values[3]), decimal(values[4])
        if None in (player, year, rating, dev, games):
            raise ValueError(f"{key}: unexpected rating row {values}")
        self.db.execute("INSERT INTO rating_observations VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (row_id, player, year, kind, rank, rating, dev, games))

    def import_listing(self, key, row_id, values, links, table, active_listings):
        kind, number = key
        column = 0 if kind == "player" else 1
        if len(links) <= column:
            return
        target = next((link[4] for link in links[column]
                       if link[4] and link[4][0] in ("match", "tournament")), None)
        if target:
            player = number if kind == "player" else None
            year = number if kind == "year" else None
            location = number if kind == "location" else None
            detail = marker = score = other = games = note = None
            if kind != "player":
                marker, detail = values[0], values[2]
            elif target[0] == "match":
                marker, score, other, note = values[1], decimal(values[2]), decimal(values[4]), values[5]
            else:
                detail = values[1]
                if "/" in values:
                    slash = values.index("/")
                    score, games = decimal(values[slash - 1]), decimal(values[slash + 1])
                    note = values[slash + 2] if len(values) > slash + 2 else None
            self.db.execute("INSERT INTO event_listings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (row_id, event_id(target), player, year, location, values[column],
                             detail or None, marker or None, score, other, games, note or None))
            if kind == "player" and target[0] == "tournament":
                active_listings[table] = row_id
        elif table in active_listings and len(values) >= 3 and not values[0] and values[1]:
            self.db.execute("INSERT INTO event_listing_details VALUES (?, ?, ?, ?)",
                            (row_id, active_listings[table], values[1], values[2] or None))

    def insert_entities(self):
        for key, entry in sorted(self.entities.items()):
            kind, number = key
            file_id = entry.get("file_id")
            name = entry.get("heading") or entry.get("label")
            get = entry.get
            if kind == "player":
                self.db.execute("INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                (number, file_id, name, get("full_name"), get("also_known_as"),
                                 get("born"), get("died"), get("created"), get("updated")))
            elif kind == "year":
                self.db.execute("INSERT INTO years VALUES (?, ?)", (number, file_id))
            elif kind == "location":
                self.db.execute("INSERT INTO locations VALUES (?, ?, ?, ?)",
                                (number, file_id, name, get("full_name")))
            else:
                self.db.execute("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                (event_id(key), kind, file_id, name, get("place"), get("start_date"),
                                 get("end_date"), get("status"), get("created"), get("updated"),
                                 get("full_name")))


def linked_number(links, kind):
    return next((link[4][1] for link in links if link[4] and link[4][0] == kind), None)


def build(source, destination):
    entries, urls = read_manifests(source)
    files = {path: i for i, path in enumerate(sorted(
        file.relative_to(source).as_posix() for file in source.rglob("*") if file.is_file()
    ), 1)}
    with closing(sqlite3.connect(destination)) as db:
        db.executescript(Path(__file__).with_name("schema.sql").read_text(encoding="utf-8"))
        db.execute("BEGIN")
        # Links and observations may precede their targets. Check the complete staged database below.
        archive = Archive(db, files)
        for path, file_id in files.items():
            source_url = urls.get(path)
            if source_url is None and (page_key(path) or path in REFERENCE_PAGES):
                source_url = BASE_URL + path
            archive.import_file(path, (source / path).read_bytes(), source_url)
            if file_id % 5000 == 0:
                print(f"Archived {file_id:,} of {len(files):,} files", flush=True)
        for filename, records in entries.items():
            db.executemany(
                "INSERT INTO source_manifest_entries VALUES (?, ?, ?, ?, ?)",
                ((files[filename], line, url, path, files.get(path)) for line, url, path in records),
            )
        archive.insert_entities()
        db.execute("ANALYZE")
        db.commit()
        if db.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            raise ValueError("SQLite integrity check failed")
        if db.execute("PRAGMA foreign_key_check").fetchone() is not None:
            raise ValueError("SQLite foreign key check failed")
        for table in ("source_files", "players", "ratings", "matches", "match_results",
                      "tournaments", "tournament_results", "reference_entries", "locations"):
            print(f"{table}: {db.execute(f'SELECT count(*) FROM {table}').fetchone()[0]:,}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "public" / "data" / "edo")
    parser.add_argument("--output", type=Path, default=ROOT / ".cache" / "edo" / "edo.sqlite")
    parser.add_argument("--replace", action="store_true", help="Replace an existing output after validation.")
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if output.is_relative_to(source):
        parser.error("Choose an output outside the source directory.")
    if output.exists() and not args.replace:
        parser.error(f"{output} already exists. Use --replace to rebuild it.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="edo-", dir=output.parent) as directory:
        staged = Path(directory) / output.name
        build(source, staged)
        if args.replace:
            os.replace(staged, output)
        else:
            os.link(staged, output)
    print(output)


if __name__ == "__main__":
    main()
