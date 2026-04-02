// lib/generator.js — Gemini 2.0 Flash ile 3 LinkedIn post varyantı üretimi
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Araştırma sonucundan 3 farklı LinkedIn post varyantı üretir.
 * @returns {{ a: string, b: string, c: string }}
 */
async function generatePosts(konu, bakisAcisi, arastirma) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const { insights, carpici_veri, tartismali_boyut, kaynaklar } = arastirma;

  const arastirmaOzeti = `
ARAŞTIRMA BULGULARI:
- Insights: ${insights.join(' | ')}
- Çarpıcı veri: ${carpici_veri}
- Tartışmalı boyut: ${tartismali_boyut}
- Kaynak sayısı: ${kaynaklar.length}
  `.trim();

  const prompt = `
Sen Türkiye'nin önde gelen AI ve iş dünyası LinkedIn düşünce liderlerinden birisin.
Konu: "${konu}"
${bakisAcisi ? `Kişisel bakış açısı: "${bakisAcisi}"` : ''}

${arastirmaOzeti}

Bu bilgileri kullanarak 3 FARKLI LinkedIn post varyantı yaz.

FORMAT KURALLARI (her varyant için):
- Maksimum 3.000 karakter
- İlk 2 satır (hook) 210 karakteri geçmemeli
- Türkçe yaz
- 5-8 hashtag post sonunda
- Emoji kullan ama abartma

VARYANT A — Veri Odaklı (otoriter, analist tonu):
- Güçlü istatistikle başla
- Araştırma verilerini ön plana çıkar
- "Bu ne anlama geliyor?" sorusunu cevapla

VARYANT B — Hikaye Anlatımı (samimi, kişisel):
- Kişisel gözlem veya sahneyle başla
- Bakış açısını hikayeyle bütünleştir
- Empati kur

VARYANT C — Tartışma Açıcı (cesur, provoke edici):
- Karşı sezgisel soruyla başla
- Yaygın kanıya meydan oku
- Tartışmaya davet et

Çıktıyı SADECE bu JSON formatında ver, başka açıklama ekleme:
{
  "a": "<varyant A tam metni>",
  "b": "<varyant B tam metni>",
  "c": "<varyant C tam metni>"
}
  `.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Generator hatası:', e.message);
  }

  return {
    a: 'Post üretilemedi, lütfen tekrar dene.',
    b: 'Post üretilemedi, lütfen tekrar dene.',
    c: 'Post üretilemedi, lütfen tekrar dene.',
  };
}

module.exports = { generatePosts };
