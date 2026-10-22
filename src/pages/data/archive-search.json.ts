import type { APIRoute } from 'astro';
import { loadArchiveIndex } from '../../lib/archive-index';
export const GET:APIRoute=async()=>new Response(JSON.stringify(await loadArchiveIndex()),{headers:{'Content-Type':'application/json; charset=utf-8'}});
