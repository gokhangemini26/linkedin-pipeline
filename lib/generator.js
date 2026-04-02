// lib/generator.js
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Araştırma sonucundan 3 farklı LinkedIn post varyantı üretir.
 * @returns {{ a: string, b: string, c: string }}
 */
async function generatePosts(konu, bakisAcisi, arastirma) {
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
- İlk 2 satır (hook) 210 karakteri geçmemeli — "Daha fazla gör" butonundan önce bu görünür
- Türkçe yaz
- 5-8 hashtag post sonunda (#YapayZeka #Teknoloji #Innovation vb.)
- Emoji kullan ama abartma

VARYANT A — Veri Odaklı (otoriter, analist tonu):
- Güçlü bir istatistikle başla
- Araştırma verilerini ön plana çıkar
- "Bu ne anlama geliyor?" sorusunu cevapla
- CTA: Okuyucuyu düşünmeye sevk et

VARYANT B — Hikaye Anlatımı (samimi, kişisel):
- Kişisel gözlem veya sahne ile başla
- Bakış açısını hikayeyle bütünleştir
- Empati kur, okuyucunun deneyimiyle bağlantı kur
- CTA: Deneyim paylaşımı iste

VARYANT C — Tartışma Açıcı (cesur, provoke edici):
- Karşı sezgisel bir soruyla başla
- Yaygın kanıya meydan oku
- Tartışmalı boyutu işle
- CTA: Yorum/tartışma davet et

Çıktıyı SADECE bu JSON formatında ver, başka açıklama ekleme:
{
  "a": "<varyant A tam metni>",
  "b": "<varyant B tam metni>",
  "c": "<varyant C tam metni>"
}
  `.trim();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  });

  const fullText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  try {
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Post JSON parse hatası:', e);
  }

  // Fallback
  return { a: fullText, b: fullText, c: fullText };
}

module.exports = { generatePosts };
