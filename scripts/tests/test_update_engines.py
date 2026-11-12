from http.client import RemoteDisconnected
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location(
    "update_engines", Path(__file__).parents[1] / "engines" / "update_engines.py"
)
update_engines = importlib.util.module_from_spec(spec)
spec.loader.exec_module(update_engines)


def mock_json_response(payload: str, status: int = 200) -> MagicMock:
    response = MagicMock()
    response.status = status
    response.read.return_value = payload.encode("utf-8")
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    return response


class UpdateEnginesRetryTests(unittest.TestCase):
    def test_retries_remote_disconnected_then_succeeds(self):
        url = "https://api.github.com/repos/example/engine/releases/latest"
        effects = [
            RemoteDisconnected("Remote end closed connection without response"),
            mock_json_response('{"tag_name": "v1.0.0"}'),
        ]
        with patch.object(update_engines, "urlopen", side_effect=effects) as mock_open, patch.object(
            update_engines.time, "sleep"
        ) as mock_sleep:
            status, data = update_engines.fetch_json(url, token=None)

        self.assertEqual(status, 200)
        self.assertEqual(data, {"tag_name": "v1.0.0"})
        self.assertEqual(mock_open.call_count, 2)
        mock_sleep.assert_called_once_with(1.0)

    def test_exhausted_disconnect_retries_raise_runtime_error(self):
        url = "https://api.github.com/repos/example/engine/releases/latest"
        err = RemoteDisconnected("Remote end closed connection without response")
        with patch.object(update_engines, "urlopen", side_effect=err) as mock_open, patch.object(
            update_engines.time, "sleep"
        ) as mock_sleep:
            with self.assertRaisesRegex(RuntimeError, "GitHub API request failed"):
                update_engines.fetch_json(url, token=None)

        self.assertEqual(mock_open.call_count, update_engines.MAX_ATTEMPTS)
        self.assertEqual(mock_sleep.call_count, update_engines.MAX_ATTEMPTS - 1)

    def test_retries_transient_502_with_bounded_backoff(self):
        url = "https://api.github.com/repos/example/engine"
        http_502 = HTTPError(url, 502, "Bad Gateway", hdrs={"Retry-After": "120"}, fp=io.BytesIO(b"bad gateway"))
        effects = [http_502, mock_json_response('{"full_name": "example/engine"}')]
        with patch.object(update_engines, "urlopen", side_effect=effects) as mock_open, patch.object(
            update_engines.time, "sleep"
        ) as mock_sleep:
            status, data = update_engines.fetch_json(url, token="tok")

        self.assertEqual(status, 200)
        self.assertEqual(data, {"full_name": "example/engine"})
        self.assertEqual(mock_open.call_count, 2)
        mock_sleep.assert_called_once_with(update_engines.MAX_BACKOFF_SECONDS)

    def test_404_returns_immediately_without_retry(self):
        url = "https://api.github.com/repos/example/engine/releases/latest"
        http_404 = HTTPError(url, 404, "Not Found", hdrs={}, fp=io.BytesIO(b"not found"))
        with patch.object(update_engines, "urlopen", side_effect=http_404) as mock_open, patch.object(
            update_engines.time, "sleep"
        ) as mock_sleep:
            status, data = update_engines.fetch_json(url, token=None)

        self.assertEqual(status, 404)
        self.assertIsNone(data)
        self.assertEqual(mock_open.call_count, 1)
        mock_sleep.assert_not_called()


class ReleaseHistoryTests(unittest.TestCase):
    def test_paginates_public_releases_and_ignores_drafts(self):
        def release(tag, day, **fields):
            return {"tag_name": tag, "published_at": f"2026-01-0{day}T00:00:00Z",
                    "html_url": f"https://github.com/example/engine/releases/tag/{tag}", **fields}

        pages = [(200, [release("v2", 2, prerelease=True), release("draft", 3, draft=True)]),
                 (200, [release("v1", 1)])]
        with patch.object(update_engines, "RELEASE_PAGE_SIZE", 2), patch.object(
            update_engines, "fetch_json", side_effect=pages
        ) as fetch, patch.object(update_engines.time, "sleep"):
            history = update_engines.fetch_releases("example/engine", None, 0)
        self.assertEqual([row["tag"] for row in history], ["v2", "v1"])
        self.assertTrue(history[0]["prerelease"])
        self.assertTrue(fetch.call_args.args[0].endswith("page=2"))

    def test_latest_endpoint_can_supplement_the_list(self):
        latest = {"tag": "v2", "published_at": "2026-01-02"}
        older = {"tag": "v1", "published_at": "2026-01-01"}
        self.assertEqual(update_engines.include_latest([older], latest), [latest, older])
        self.assertEqual(update_engines.include_latest([latest, older], latest), [latest, older])

    def test_invalid_history_response_fails_the_refresh(self):
        with patch.object(update_engines, "fetch_json", return_value=(404, None)):
            with self.assertRaisesRegex(RuntimeError, "Invalid release history"):
                update_engines.fetch_releases("example/engine", None, 0)

    def test_latest_release_lookup_distinguishes_missing_repositories_and_releases(self):
        response = {"data": {"r0": {"latestRelease": {"tagName": "v3"}}, "r1": {"latestRelease": None}, "r2": None},
                    "errors": [{"type": "NOT_FOUND", "path": ["r2"]}]}
        with patch.object(update_engines, "fetch_json", return_value=(200, response)) as fetch:
            tags = update_engines.fetch_latest_tags(["example/engine", "example/unreleased", "example/missing"], "token")
        self.assertEqual(tags, {"example/engine": "v3", "example/unreleased": None})
        self.assertIn("latestRelease", fetch.call_args.kwargs["payload"]["query"])


if __name__ == "__main__":
    unittest.main()

