import json
from pathlib import Path
from subprocess import CompletedProcess
import sys
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).parents[1] / "engines"))
from build_catalog import assess, build
import discover_engines


def repository(description, readme="", repo="example/Engine"):
    return {
        "nameWithOwner": repo,
        "description": description,
        "isTemplate": False,
        "isArchived": False,
        "isFork": False,
        "primaryLanguage": {"name": "Rust"},
        "licenseInfo": None,
        "defaultBranchRef": {"target": {"oid": "a" * 40}},
        "root": None,
        "readme": {"README.md": readme} if readme else {},
    }


class EngineCatalogTests(unittest.TestCase):
    def test_engine_using_winboard_is_included(self):
        record = repository(
            "A chess engine using the XBoard chess protocol",
            "This chess engine can be loaded in any compatible chess GUI.",
        )
        self.assertEqual(assess(record, None), ("readme", "README.md"))

    def test_external_engine_clients_and_templates_are_excluded(self):
        client = repository("A chess GUI using Stockfish")
        template = repository("A UCI chess engine template")
        self.assertEqual(assess(client, None)[0], "related")
        self.assertEqual(assess(template, None)[0], "related")

    def test_two_player_rules_without_computer_play_are_excluded(self):
        record = repository("A Python chess engine", "A two-player chess game for the desktop.")
        self.assertEqual(assess(record, None)[0], "related")

    def test_redirects_merge_provenance_without_duplicating_engine(self):
        record = repository("A chess engine", "A chess engine written in Rust.")
        candidates = [{"repo": "example/Engine", "queries": ["topic:chess-engine"]}]
        manifest = [{"repo": "old/Engine", "name": "Engine"}]
        evidence = [
            {"requested": "example/Engine", "repository": record},
            {"requested": "old/Engine", "repository": record},
        ]
        engines, _, excluded = build(candidates, evidence, manifest, {"old/engine"})
        self.assertFalse(excluded)
        self.assertEqual(len(engines), 1)
        self.assertEqual(engines[0]["found_by"], ["topic:chess-engine"])
        self.assertEqual(engines[0]["seed_sources"], ["existing-manifest", "RWBC GitHub index"])
        self.assertTrue(engines[0]["evidence"]["url"].endswith("/README.md"))

    def test_missing_evidence_blocks_the_snapshot(self):
        with self.assertRaisesRegex(ValueError, "Missing evidence checks"):
            build([{"repo": "example/Engine", "queries": []}], [], [], set())

    def test_manual_source_evidence_links_to_the_checked_file(self):
        candidates = [{"repo": "example/Engine", "queries": []}]
        evidence = [{"requested": "example/Engine", "repository": repository(None)}]
        review = {"include": {"example/Engine": "src/My Bot.cs"}, "exclude": {}}
        engines, _, _ = build(candidates, evidence, [], set(), review)
        self.assertEqual(engines[0]["evidence"]["type"], "reviewed-source")
        self.assertTrue(engines[0]["evidence"]["url"].endswith("/src/My%20Bot.cs"))

    def test_search_splits_ranges_and_paginates_the_smaller_ranges(self):
        responses = iter([
            (3, []),
            (1, ["example/First"]),
            (2, ["example/Second"]),
            (2, ["example/Third"]),
        ])
        requests = []

        def request(command, **_options):
            query = parse_qs(urlsplit(command[2]).query)
            requests.append((query["q"][0], query["page"][0]))
            total, names = next(responses)
            body = {"total_count": total, "incomplete_results": False,
                    "items": [{"full_name": name} for name in names]}
            return CompletedProcess(command, 0, json.dumps(body), "")

        with patch.multiple(discover_engines, SEARCH_LIMIT=2, PAGE_SIZE=1), patch.object(
            discover_engines.subprocess, "run", side_effect=request
        ), patch.object(discover_engines.time, "sleep"):
            matches = discover_engines.search_candidates(("topic:chess-engine",))
        self.assertEqual(list(matches), ["example/first", "example/second", "example/third"])
        self.assertNotEqual(requests[1][0], requests[2][0])
        self.assertEqual(requests[3], (requests[2][0], "2"))
