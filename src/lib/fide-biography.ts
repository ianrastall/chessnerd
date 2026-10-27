/** Optional public biographical data, joined by Wikidata's FIDE ID (P1440).
 * Rating archives remain the authority for ratings; no name-based matching.
 */
export interface Biography {
  source: string;
  born: string;
  died: string;
  birthplace: string;
  description: string;
  article: string;
  image: string;
}

type Binding = Record<string, { value: string }>;
const value = (row: Binding, key: string) => row[key]?.value ?? '';

function date(row: Binding, key: string): string {
  const raw = value(row, key);
  const precision = Number(value(row, `${key}Precision`));
  return raw && precision >= 9 ? raw.slice(0, precision >= 11 ? 10 : precision === 10 ? 7 : 4) : '';
}

export async function loadBiography(id: number): Promise<Biography | null> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid FIDE ID');
  const query = `SELECT ?item ?description ?born ?bornPrecision ?died ?diedPrecision ?placeLabel ?image ?article WHERE {
    ?item wdt:P1440 "${id}".
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
    OPTIONAL { ?item p:P569/psv:P569 ?b. ?b wikibase:timeValue ?born; wikibase:timePrecision ?bornPrecision. }
    OPTIONAL { ?item p:P570/psv:P570 ?d. ?d wikibase:timeValue ?died; wikibase:timePrecision ?diedPrecision. }
    OPTIONAL { ?item wdt:P19 ?place. }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  const response = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: 'json' })}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Biographical source unavailable');
  const rows: Binding[] = (await response.json()).results.bindings;
  if (!rows.length) return null;
  // Ambiguous identifier matches must not attach someone else's biography.
  if (new Set(rows.map(row => value(row, 'item'))).size !== 1) throw new Error('Ambiguous FIDE ID in Wikidata');
  const row = rows[0];
  const source = value(row, 'item').replace(/^http:/, 'https:');
  if (!/^https:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(source)) throw new Error('Invalid biography source');
  const article = value(row, 'article');
  const image = value(row, 'image');
  return {
    source,
    born: date(row, 'born'), died: date(row, 'died'),
    birthplace: value(row, 'placeLabel'), description: value(row, 'description'),
    article: article.startsWith('https://en.wikipedia.org/wiki/') ? article : '',
    image: /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//.test(image) ? image : ''
  };
}

export interface Portrait { url: string; source: string; attribution: string; license: string; licenseUrl: string }

export async function loadPortrait(image: string): Promise<Portrait | null> {
  const file = decodeURIComponent(new URL(image).pathname.split('/').pop() ?? '');
  const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', prop: 'imageinfo', titles: `File:${file}`, iiprop: 'url|extmetadata', iiurlwidth: '240' });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Photo source unavailable');
  const pages = (await response.json()).query.pages;
  const info = (Object.values(pages)[0] as { imageinfo?: { extmetadata?: Record<string, { value: string }>; thumburl?: string; url?: string; descriptionurl?: string }[] })?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  // Metadata is HTML from a third party. Display only its text, never insert it.
  const plain = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
  const attribution = plain(meta.Attribution?.value || [meta.Artist?.value, meta.Credit?.value].filter(Boolean).join(' · '));
  const license = plain(meta.LicenseShortName?.value ?? '');
  const licenseUrl = meta.LicenseUrl?.value ?? '';
  const url = info.thumburl || info.url;
  const source = info.descriptionurl;
  if (!attribution || !license || !/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(url ?? '') || !source?.startsWith('https://commons.wikimedia.org/wiki/') || !/^https:\/\//.test(licenseUrl)) return null;
  if (!url) return null;
  return { url, source, attribution, license, licenseUrl };
}
