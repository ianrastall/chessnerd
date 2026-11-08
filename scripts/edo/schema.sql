PRAGMA user_version = 2;

CREATE TABLE source_files (
    file_id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    source_url TEXT,
    byte_count INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    content_zlib BLOB NOT NULL,
    page_title TEXT,
    page_status TEXT,
    text_encoding TEXT
);

CREATE TABLE source_manifest_entries (
    manifest_file_id INTEGER NOT NULL REFERENCES source_files,
    line_number INTEGER NOT NULL,
    url TEXT NOT NULL,
    target_path TEXT NOT NULL,
    target_file_id INTEGER REFERENCES source_files,
    PRIMARY KEY (manifest_file_id, line_number)
) WITHOUT ROWID;

CREATE TABLE source_rows (
    row_id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES source_files,
    line_number INTEGER NOT NULL,
    cells_json TEXT NOT NULL
);
CREATE INDEX source_rows_file ON source_rows(file_id, line_number);

CREATE TABLE source_links (
    link_id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES source_files,
    row_id INTEGER REFERENCES source_rows,
    cell_number INTEGER,
    line_number INTEGER NOT NULL,
    tag TEXT NOT NULL,
    label TEXT,
    target_as_written TEXT NOT NULL,
    target_url TEXT NOT NULL,
    target_file_id INTEGER REFERENCES source_files
);
CREATE INDEX source_links_file ON source_links(file_id);
CREATE INDEX source_links_row ON source_links(row_id);
CREATE INDEX source_links_target ON source_links(target_file_id) WHERE target_file_id IS NOT NULL;

CREATE TABLE players (
    player_id INTEGER PRIMARY KEY,
    file_id INTEGER UNIQUE REFERENCES source_files,
    name TEXT,
    full_name TEXT,
    also_known_as TEXT,
    born TEXT,
    died TEXT,
    created TEXT,
    updated TEXT
);
CREATE INDEX players_name ON players(name COLLATE NOCASE);

CREATE TABLE years (
    year INTEGER PRIMARY KEY,
    file_id INTEGER UNIQUE REFERENCES source_files
);

CREATE TABLE locations (
    location_id INTEGER PRIMARY KEY,
    file_id INTEGER UNIQUE REFERENCES source_files,
    name TEXT,
    full_name TEXT
);

CREATE TABLE events (
    event_id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('match', 'tournament')),
    file_id INTEGER UNIQUE REFERENCES source_files,
    title TEXT,
    place TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT,
    created TEXT,
    updated TEXT,
    event_name TEXT
);

CREATE TABLE event_places (
    event_id TEXT NOT NULL REFERENCES events,
    location_id INTEGER NOT NULL REFERENCES locations,
    row_id INTEGER NOT NULL REFERENCES source_rows,
    PRIMARY KEY (event_id, location_id, row_id)
) WITHOUT ROWID;

CREATE TABLE rating_observations (
    row_id INTEGER PRIMARY KEY REFERENCES source_rows,
    player_id INTEGER NOT NULL REFERENCES players,
    year INTEGER NOT NULL REFERENCES years,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('player', 'year')),
    rank INTEGER,
    rating INTEGER NOT NULL,
    deviation INTEGER NOT NULL,
    games NUMERIC NOT NULL
);
CREATE INDEX rating_observations_player ON rating_observations(player_id, year, source_kind);
CREATE INDEX rating_observations_year ON rating_observations(year, rank);

CREATE VIEW ratings AS
SELECT player_id, year, rank, rating, deviation, games, source_kind, row_id
FROM (
    SELECT *, row_number() OVER (
        PARTITION BY player_id, year ORDER BY source_kind, row_id
    ) AS preference
    FROM rating_observations
)
WHERE preference = 1;

CREATE VIEW rating_disagreements AS
SELECT p.player_id, p.year, p.row_id AS player_row_id, y.row_id AS year_row_id
FROM rating_observations AS p
JOIN rating_observations AS y USING (player_id, year)
WHERE p.source_kind = 'player' AND y.source_kind = 'year'
  AND (p.rank IS NOT y.rank OR p.rating IS NOT y.rating
       OR p.deviation IS NOT y.deviation OR p.games IS NOT y.games);

CREATE TABLE match_results (
    row_id INTEGER PRIMARY KEY REFERENCES source_rows,
    event_id TEXT NOT NULL REFERENCES events,
    player_id INTEGER REFERENCES players,
    player_name TEXT NOT NULL,
    rating INTEGER,
    deviation INTEGER,
    score REAL,
    games REAL,
    score_text TEXT NOT NULL,
    games_text TEXT NOT NULL
);
CREATE INDEX match_results_event ON match_results(event_id, row_id);
CREATE INDEX match_results_player ON match_results(player_id);

CREATE TABLE tournament_result_sets (
    result_set_id INTEGER PRIMARY KEY REFERENCES source_rows,
    event_id TEXT NOT NULL REFERENCES events,
    label TEXT NOT NULL CHECK (label IN ('Crosstable scores', 'Match scores'))
);
CREATE INDEX tournament_result_sets_event ON tournament_result_sets(event_id, result_set_id);

CREATE TABLE tournament_results (
    row_id INTEGER PRIMARY KEY REFERENCES source_rows,
    result_set_id INTEGER NOT NULL REFERENCES tournament_result_sets,
    match_group INTEGER,
    player_id INTEGER REFERENCES players,
    player_name TEXT NOT NULL,
    rating INTEGER,
    deviation INTEGER,
    score REAL NOT NULL,
    games REAL NOT NULL,
    score_text TEXT NOT NULL,
    games_text TEXT NOT NULL,
    class_text TEXT
);
CREATE INDEX tournament_results_set ON tournament_results(result_set_id, row_id);
CREATE INDEX tournament_results_player ON tournament_results(player_id);

CREATE TABLE event_listings (
    row_id INTEGER PRIMARY KEY REFERENCES source_rows,
    event_id TEXT NOT NULL REFERENCES events,
    player_id INTEGER REFERENCES players,
    year INTEGER REFERENCES years,
    location_id INTEGER REFERENCES locations,
    title TEXT NOT NULL,
    detail TEXT,
    marker TEXT,
    score REAL,
    opponent_score REAL,
    games REAL,
    note TEXT,
    CHECK ((player_id IS NOT NULL) + (year IS NOT NULL) + (location_id IS NOT NULL) = 1)
);
CREATE INDEX event_listings_event ON event_listings(event_id);
CREATE INDEX event_listings_player ON event_listings(player_id);
CREATE INDEX event_listings_year ON event_listings(year);
CREATE INDEX event_listings_location ON event_listings(location_id);

CREATE TABLE event_listing_details (
    row_id INTEGER PRIMARY KEY REFERENCES source_rows,
    listing_row_id INTEGER NOT NULL REFERENCES event_listings,
    label TEXT NOT NULL,
    result_text TEXT
);
CREATE INDEX event_listing_details_listing ON event_listing_details(listing_row_id);

CREATE TABLE page_notes (
    row_id INTEGER PRIMARY KEY REFERENCES source_rows,
    file_id INTEGER NOT NULL REFERENCES source_files,
    text TEXT NOT NULL
);
CREATE INDEX page_notes_file ON page_notes(file_id);

CREATE TABLE citations (
    row_id INTEGER PRIMARY KEY REFERENCES source_rows,
    file_id INTEGER NOT NULL REFERENCES source_files,
    category TEXT NOT NULL,
    text TEXT NOT NULL
);
CREATE INDEX citations_file ON citations(file_id);

CREATE TABLE reference_entries (
    row_id INTEGER PRIMARY KEY REFERENCES source_rows,
    category TEXT NOT NULL CHECK (category IN ('Books', 'Periodicals', 'Web', 'Rating notes')),
    label TEXT NOT NULL,
    description TEXT,
    coverage TEXT,
    additional_coverage TEXT
);
CREATE INDEX reference_entries_label ON reference_entries(category, label);

CREATE VIEW matches AS SELECT * FROM events WHERE kind = 'match';
CREATE VIEW tournaments AS SELECT * FROM events WHERE kind = 'tournament';

CREATE VIEW tournament_entries AS
SELECT l.*
FROM event_listings AS l JOIN tournaments AS t USING (event_id)
WHERE l.player_id IS NOT NULL;

CREATE VIEW event_players AS
SELECT event_id, player_id FROM event_listings WHERE player_id IS NOT NULL
UNION
SELECT event_id, player_id FROM match_results WHERE player_id IS NOT NULL
UNION
SELECT s.event_id, r.player_id
FROM tournament_result_sets AS s JOIN tournament_results AS r USING (result_set_id)
WHERE r.player_id IS NOT NULL;

CREATE VIEW event_years AS
SELECT DISTINCT event_id, year FROM event_listings WHERE year IS NOT NULL;

CREATE VIEW event_locations AS
SELECT event_id, location_id FROM event_listings WHERE location_id IS NOT NULL
UNION
SELECT event_id, location_id FROM event_places;
