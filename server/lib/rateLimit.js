

const SWEEP_EVERY = 5 * 60 * 1000;

export function rateLimit({ windowMs, max, message = 'Too many requests.' }) {
  const hits = new Map(); 

  
  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, times] of hits) {
      const live = times.filter((t) => t > cutoff);
      if (live.length) hits.set(ip, live);
      else hits.delete(ip);
    }
  }, SWEEP_EVERY);
  sweep.unref();

  return (req, res, next) => {
    const now = Date.now();
    const cutoff = now - windowMs;
    const ip = req.ip || 'unknown';

    const times = (hits.get(ip) || []).filter((t) => t > cutoff);

    if (times.length >= max) {
      const retryAfter = Math.ceil((times[0] + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retryAfter });
    }

    times.push(now);
    hits.set(ip, times);
    res.set('X-RateLimit-Remaining', String(max - times.length));
    next();
  };
}
