// api/webhook.js
const { research } = require('../lib/researcher');
const { generatePosts } = require('../lib/generator');
const { sendMessage, sendPostsWithButtons, sendSuccess, sendError } = require('../lib/telegram');
const { publishPost } = require('../lib/linkedin');

// Onay bekleyen postları geçici hafızada tut
// (Vercel stateless olduğu için KV store yoksa basit global kullanıyoruz)
// Production'da Vercel KV veya Redis kullan
const pendingPosts = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'LinkedIn Pipeline aktif' });
  }

  const body = req.body;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  try {
    // ── Callback Query (inline buton tıklaması) ──
    if (body.callback_query) {
      const { data, from } = body.callback_query;
      const userId = String(from.id);

      // Callback'i acknowledge et
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: body.callback_query.id }),
        }
      );

      if (data === 'cancel') {
        await sendMessage(chatId, '❌ İptal edildi. Yeni içerik için /linkedin <konu> yaz.');
        delete pendingPosts[userId];
        return res.status(200).json({ ok: true });
      }

      const variant = data.replace('approve_', ''); // 'a', 'b' veya 'c'
      const posts = pendingPosts[userId];

      if (!posts) {
        await sendMessage(chatId, '⚠️ Post bulunamadı. Tekrar /linkedin komutu gönder.');
        return res.status(200).json({ ok: true });
      }

      const selectedPost = posts[variant];
      await sendMessage(chatId, `⏳ LinkedIn'e yayınlanıyor...`);

      const result = await publishPost(selectedPost);

      if (result.success) {
        await sendSuccess(chatId, selectedPost);
        delete pendingPosts[userId];
      } else {
        await sendError(chatId, result.error);
      }

      return res.status(200).json({ ok: true });
    }

    // ── Normal Mesaj ──
    if (!body.message) {
      return res.status(200).json({ ok: true });
    }

    const message = body.message;
    const text = (message.text || '').trim();
    const userId = String(message.from.id);

    // Güvenlik: sadece yetkili chat
    if (String(message.chat.id) !== chatId) {
      return res.status(200).json({ ok: true });
    }

    // /start komutu
    if (text === '/start') {
      await sendMessage(
        chatId,
        `👋 *LinkedIn Pipeline Bot'a hoş geldin!*\n\n` +
          `Kullanım:\n` +
          `📌 \`/linkedin <konu>\` — Sadece konu\n` +
          `📌 \`/linkedin <konu> | <bakış açısı>\` — Konu + görüşün\n\n` +
          `Örnek:\n` +
          `\`/linkedin AI ve tekstil ihracatı | Bu trendi kaçıranlar 2 yıla kadar geride kalacak\``
      );
      return res.status(200).json({ ok: true });
    }

    // /linkedin komutu
    if (text.startsWith('/linkedin')) {
      const icerik = text.replace('/linkedin', '').trim();

      if (!icerik) {
        await sendMessage(chatId, '⚠️ Konu belirtmelisin. Örnek: `/linkedin AI ve ihracat`');
        return res.status(200).json({ ok: true });
      }

      // Konu ve bakış açısını ayır (| ile)
      const [konu, bakisAcisi = ''] = icerik.split('|').map((s) => s.trim());

      // Başlangıç mesajı
      await sendMessage(
        chatId,
        `🔍 *"${konu}"* konusunda araştırma başladı...\n` +
          `${bakisAcisi ? `💡 Bakış açısı: _${bakisAcisi}_\n` : ''}` +
          `⏳ 2-3 dakika sürebilir, bekle.`
      );

      // ADIM 1: Araştırma
      await sendMessage(chatId, `📡 Web ve YouTube'da kaynaklar taranıyor...`);
      const arastirma = await research(konu, bakisAcisi);

      await sendMessage(
        chatId,
        `✅ ${arastirma.kaynaklar.length} kaynak bulundu.\n✍️ LinkedIn postları üretiliyor...`
      );

      // ADIM 2: Post üretimi
      const posts = await generatePosts(konu, bakisAcisi, arastirma);

      // Postları hafızaya al
      pendingPosts[userId] = posts;

      // ADIM 3: Telegram'a gönder
      await sendPostsWithButtons(chatId, konu, posts);

      return res.status(200).json({ ok: true });
    }

    // Bilinmeyen komut
    await sendMessage(chatId, `❓ Komut tanınamadı. \`/start\` yaz veya \`/linkedin <konu>\` kullan.`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook hatası:', err);
    await sendError(chatId, err.message || 'Bilinmeyen hata');
    return res.status(200).json({ ok: true }); // Telegram 200 beklediği için her zaman 200
  }
}
