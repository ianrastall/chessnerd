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


if __name__ == "__main__":
    unittest.main()

