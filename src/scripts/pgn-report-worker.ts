import { analyzePgn } from '../lib/pgn-report';

self.addEventListener('message', async (event: MessageEvent<string | File>) => {
  try {
    const source = event.data;
    const report = typeof source === 'string' ? analyzePgn(source) : analyzePgn(await source.text(), source.size);
    self.postMessage(report);
  } catch {
    self.postMessage(null);
  }
});
