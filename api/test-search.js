// api/test-search.js — Google Search API test endpoint
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  // Env var kontrolü
  if (!apiKey || !cx) {
    return res.status(200).json({
      status: 'ERROR',
      mesaj: 'Env var eksik',
      GOOGLE_SEARCH_API_KEY: apiKey ? '✅ var' : '❌ YOK',
      GOOGLE_SEARCH_CX: cx ? '✅ var' : '❌ YOK',
    });
  }

  // API testi
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=yapay+zeka+2025&num=3`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.status(200).json({
        status: 'API_HATA',
        hata_kodu: data.error.code,
        hata_mesaji: data.error.message,
        api_key_ilk5: apiKey.slice(0, 5) + '...',
        cx_ilk5: cx.slice(0, 5) + '...',
      });
    }

    return res.status(200).json({
      status: 'BAŞARILI',
      bulunan_sonuc: data.items?.length || 0,
      ilk_baslik: data.items?.[0]?.title || 'yok',
    });

  } catch (e) {
    return res.status(200).json({
      status: 'FETCH_HATA',
      hata: e.message,
    });
  }
}
