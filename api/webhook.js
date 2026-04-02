// api/webhook.js
const { research } = require('../lib/researcher');
const { generatePosts } = require('../lib/generator');
const { sendMessage, sendPostsWithButtons, sendSuccess, sendError } = require('../lib/telegram');
const { publishPost } = require('../lib/linkedin');

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// Vercel stateless — session'ı module scope'da tut (aynı warm instance içinde çalışır)
// Production'da Vercel KV kullan
const sessions = new Map();

async function answerCallback(callbackQueryId) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'LinkedIn Pipeline aktif' });
  }

  const body = req.body;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  try {
    // ── Callback (buton tıklaması) ──
    if (body.callback_query) {
      const { data, from, id: cbId } = body.callback_query;
      const userId = String(from.id);
      await answerCallback(cbId);

      // Kaynak onayı → post üret
      if (data === 'approve_sources') {
        const session = sessions.get(userId);
        if (!session) {
          await sendMessage(chatId, '⚠️ Oturum süresi doldu. Tekrar /linkedin <konu> gönder.');
          return res.status(200).json({ ok: true });
        }
        await sendMessage(chatId, '✍️ Onaylandı! 3 varyant üretiliyor...');
        const posts = await generatePosts(session.konu, session.bakisAcisi, session.arastirma);
        sessions.set(userId, { ...session, posts });
        await sendPostsWithButtons(chatId, session.konu, posts);
        return res.status(200).json({ ok: true });
      }

      // Kaynak reddi / iptal
      if (data === 'reject_sources' || data === 'cancel') {
        sessions.delete(userId);
        await sendMessage(chatId, '❌ İptal edildi. Yeni içerik için /linkedin <konu> yaz.');
        return res.status(200).json({ ok: true });
      }

      // Post seçimi
      if (data.startsWith('approve_')) {
        const variant = data.replace('approve_', '');
        const session = sessions.get(userId);
        if (!session?.posts) {
          await sendMessage(chatId, '⚠️ Oturum süresi doldu. Tekrar /linkedin <konu> gönder.');
          return res.status(200).json({ ok: true });
        }
        const selectedPost = session.posts[variant];

        if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_PERSON_ID) {
          await sendMessage(chatId, '⏳ LinkedIn\'e yayınlanıyor...');
          const result = await publishPost(selectedPost);
          result.success
            ? await sendSuccess(chatId, selectedPost)
            : await sendError(chatId, result.error);
        } else {
          await sendMessage(chatId,
            `✅ *Seçilen post — kopyala ve LinkedIn'e yapıştır:*\n\n${selectedPost}`
          );
        }
        sessions.delete(userId);
        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
    }

    // ── Normal mesaj ──
    if (!body.message) return res.status(200).json({ ok: true });

    const message = body.message;
    const text = (message.text || '').trim();
    const userId = String(message.from.id);

    if (String(message.chat.id) !== chatId) return res.status(200).json({ ok: true });

    // /start
    if (text === '/start') {
      await sendMessage(chatId,
        `👋 *LinkedIn Pipeline Bot'a hoş geldin!*\n\n` +
        `📌 *Kullanım:*\n` +
        `\`/linkedin <konu>\`\n` +
        `\`/linkedin <konu> | <bakış açısı>\`\n\n` +
        `*Örnek:*\n` +
        `\`/linkedin AI ve tekstil | Bence bunu erken benimseyenler kazanacak\``
      );
      return res.status(200).json({ ok: true });
    }

    // /linkedin
    if (text.startsWith('/linkedin')) {
      const icerik = text.replace('/linkedin', '').trim();

      if (!icerik) {
        await sendMessage(chatId, '⚠️ Konu belirt. Örnek: `/linkedin AI ve ihracat`');
        return res.status(200).json({ ok: true });
      }

      const [konu, bakisAcisi = ''] = icerik.split('|').map(s => s.trim());

      // Önceki session'ı temizle
      sessions.delete(userId);

      await sendMessage(chatId,
        `🔍 *"${konu}"* araştırılıyor...\n` +
        `${bakisAcisi ? `💡 _Bakış açısı: ${bakisAcisi}_\n` : ''}` +
        `⏳ Kaynaklar aranıyor...`
      );

      const arastirma = await research(konu, bakisAcisi);
      const { kaynaklar } = arastirma;

      // Session'a kaydet
      sessions.set(userId, { konu, bakisAcisi, arastirma });

      if (kaynaklar.length > 0) {
        const kaynakListesi = kaynaklar
          .map((k, i) => `${i + 1}. [${k.baslik}](${k.url})\n_${k.ozet?.slice(0, 100)}..._`)
          .join('\n\n');

        await sendMessage(chatId,
          `✅ *${kaynaklar.length} kaynak bulundu (${arastirma.aralikLabel || "son 7 gün"}):*\n\n${kaynakListesi}\n\n` +
          `Bu kaynaklarla post üreteyim mi?`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Evet, post üret', callback_data: 'approve_sources' },
                { text: '❌ İptal', callback_data: 'reject_sources' },
              ]],
            },
          }
        );
      } else {
        await sendMessage(chatId, `⚠️ Web kaynağı bulunamadı. Groq kendi bilgisiyle post üretiyor...`);
        const posts = await generatePosts(konu, bakisAcisi, arastirma);
        sessions.set(userId, { konu, bakisAcisi, arastirma, posts });
        await sendPostsWithButtons(chatId, konu, posts);
      }

      return res.status(200).json({ ok: true });
    }

    await sendMessage(chatId, `❓ Komut tanınamadı. \`/start\` yaz veya \`/linkedin <konu>\` kullan.`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook hatası:', err);
    await sendError(chatId, err.message || 'Bilinmeyen hata');
    return res.status(200).json({ ok: true });
  }
}
