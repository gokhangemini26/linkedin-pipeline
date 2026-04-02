// lib/generator.js — Groq (Llama 3.1 70B) ile 3 LinkedIn post varyantı üretimi
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

async function groqChat(messages, maxTokens = 4000) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages,
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function generatePosts(konu, bakisAcisi, arastirma) {
  const { insights, carpici_veri, tartismali_boyut } = arastirma;

  const text = await groqChat([
    {
      role: 'system',
      content: `Sen Türkiye'nin önde gelen AI ve iş dünyası LinkedIn düşünce liderlerinden birisin. 
Türkçe, etkileyici ve profesyonel LinkedIn postları yazarsın. 
Sadece JSON formatında çıktı üretirsin.`,
    },
    {
      role: 'user',
      content: `Konu: "${konu}"
${bakisAcisi ? `Kişisel bakış açısı: "${bakisAcisi}"` : ''}

ARAŞTIRMA BULGULARI:
- Insights: ${insights.join(' | ')}
- Çarpıcı veri: ${carpici_veri}
- Tartışmalı boyut: ${tartismali_boyut}

3 FARKLI LinkedIn post varyantı yaz:

FORMAT (her varyant için):
- Maksimum 3.000 karakter
- İlk 2 satır hook olmalı (210 karakter max)
- Türkçe
- 5-8 hashtag sonunda
- Emoji kullan ama abartma

VARYANT A — Veri Odaklı: İstatistikle başla, analitik ton
VARYANT B — Hikaye: Kişisel gözlemle başla, samimi ton  
VARYANT C — Tartışma: Karşı sezgisel soruyla başla, cesur ton

SADECE bu JSON formatında yanıt ver:
{
  "a": "<varyant A tam metni>",
  "b": "<varyant B tam metni>",
  "c": "<varyant C tam metni>"
}`,
    },
  ]);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Generator JSON parse hatası:', e);
  }

  return { a: text, b: text, c: text };
}

module.exports = { generatePosts };
