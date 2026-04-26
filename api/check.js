export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, msg: 'Method not allowed' });
  }

  try {
    const originalResponse = await fetch('https://readme.hxserver.top/api/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
      },
      body: JSON.stringify(req.body),
    });

    const data = await originalResponse.json();
    res.setHeader('Content-Type', 'application/json');
    res.status(originalResponse.status).json(data);
  } catch (error) {
    console.error('[Proxy /api/check]', error);
    res.status(502).json({ ok: false, msg: '代理失败，请稍后重试' });
  }
}