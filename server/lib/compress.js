import { brotliCompressSync, gzipSync, constants } from 'node:zlib';



const TEXT = /^(text\/|application\/(json|javascript|xml)|image\/svg)/;
const MIN_BYTES = 512; 

export function compress(req, res, next) {
  const accept = req.headers['accept-encoding'] || '';
  const method = accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : null;
  if (!method) return next();

  const send = res.send.bind(res);

  res.send = (body) => {
    const type = res.get('Content-Type') || '';
    if (res.get('Content-Encoding') || !TEXT.test(type)) return send(body);

    const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
    if (buf.length < MIN_BYTES) return send(body);

    const out =
      method === 'br'
        ? brotliCompressSync(buf, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 5, 
              [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
            },
          })
        : gzipSync(buf, { level: 6 });

    res.set('Content-Encoding', method);
    res.set('Vary', 'Accept-Encoding');
    res.removeHeader('Content-Length');
    return send(out);
  };

  next();
}
