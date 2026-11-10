import { analyzePgn } from '../lib/pgn-report';

self.addEventListener('message', (event: MessageEvent<string>) => {
  self.postMessage(analyzePgn(event.data));
});
