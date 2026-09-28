import { readFileSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';



const TYPES = { '.css': 'text/css; charset=UTF-8', '.js': 'application/javascript; charset=UTF-8' };
const cache = new Map(); 

export function staticText(root) {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const type = TYPES[extname(req.path)];
    if (!type) return next();

    
    const rel = normalize(decodeURIComponent(req.path)).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, rel);
    if (!file.startsWith(root)) return next();

    let stat;
    try {
      stat = statSync(file);
    } catch {
      return next();
    }

    let entry = cache.get(file);
    if (!entry || entry.mtimeMs !== stat.mtimeMs) {
      const raw = readFileSync(file);
      entry = {
        mtimeMs: stat.mtimeMs,
        raw,
        br: brotliCompressSync(raw, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 9,
            [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
          },
        }),
        etag: `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`,
        type,
      };
      cache.set(file, entry);
    }

    res.set({
      'Content-Type': entry.type,
      'Cache-Control': 'public, max-age=300, must-revalidate',
      ETag: entry.etag,
      Vary: 'Accept-Encoding',
    });

    if (req.headers['if-none-match'] === entry.etag) return res.status(304).end();

    if ((req.headers['accept-encoding'] || '').includes('br')) {
      res.set('Content-Encoding', 'br');
      return res.end(req.method === 'HEAD' ? undefined : entry.br);
    }
    return res.end(req.method === 'HEAD' ? undefined : entry.raw);
  };
}
