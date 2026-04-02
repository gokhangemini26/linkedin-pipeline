// api/test-search.js — Tavily API test endpoint
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

export default async function handler(req, res) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ status: 'ERROR', mesaj: 'TAVILY_API_KEY eksik' });
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: 'yapay zeka 2025',
        max_results: 3,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ status: 'API_HATA', hata: data.error });
    }

    return res.status(200).json({
      status: 'BAŞARILI ✅',
      bulunan_sonuc: data.results?.length || 0,
      ilk_baslik: data.results?.[0]?.title || 'yok',
    });
  } catch (e) {
    return res.status(200).json({ status: 'FETCH_HATA', hata: e.message });
  }
}
