import type { APIRoute } from 'astro';
import { categoryHref, toolCategories } from '../data/tools';

// Every static page under src/pages, so a new route is listed without editing this file.
// Dynamic routes are expanded by hand below.
const pageFiles = Object.keys(import.meta.glob('./**/*.astro'));

function pagePaths(): string[] {
  const paths = pageFiles
    .filter((file) => !file.includes('['))
    .map((file) => file.slice(1).replace(/\.astro$/, '.html').replace(/^\/index\.html$/, '/'));
  return [...paths, ...toolCategories.map(categoryHref)].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://chessnerd.net')).origin;
  const urls = pagePaths().map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
