# LinkedIn Pipeline — Kurulum Rehberi

## 1. Vercel'e Deploy

```bash
# Projeyi klonla veya zip'i aç
cd linkedin-pipeline

# Vercel CLI ile deploy et
npm i -g vercel
vercel

# Domain şu şekilde görünecek:
# https://linkedin-pipeline-xxx.vercel.app
```

## 2. Vercel Environment Variables

Vercel Dashboard → Project → Settings → Environment Variables:

| Değişken | Değer | Nereden alınır |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` | @BotFather'dan |
| `TELEGRAM_CHAT_ID` | `123456789` | @userinfobot'tan |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com |
| `LINKEDIN_ACCESS_TOKEN` | `AQX...` | Aşağıda açıklandı |
| `LINKEDIN_PERSON_ID` | `abc123` | Aşağıda açıklandı |

## 3. Telegram Webhook Ayarı

Deploy tamamlanınca webhook'u kaydet:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<VERCEL_URL>/api/webhook"}'
```

Doğrulama:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## 4. LinkedIn Access Token Alma

1. https://www.linkedin.com/developers/ → Uygulama oluştur
2. Products → "Share on LinkedIn" ekle
3. OAuth 2.0 → `w_member_social` scope iste
4. Access token al (60 gün geçerli — yenileme için aşağıya bak)

### LinkedIn Person ID
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "https://api.linkedin.com/v2/userinfo"
# "sub" alanı = Person ID
```

### Token Yenileme (60 günde bir)
LinkedIn refresh token desteklemiyor. Seçenekler:
- Her 60 günde manuel yenile
- LinkedIn API v3 (refresh token destekli) — yakında

## 5. Test

Telegram'dan gönder:
```
/start
/linkedin Yapay zeka ve tekstil ihracatı
/linkedin AI otomasyon | Bu teknolojiyi erken benimseyenler kazanacak
```

## Sık Karşılaşılan Sorunlar

**Webhook çalışmıyor:**
- Vercel URL'nin doğru olduğunu kontrol et
- `vercel logs` ile hataları gör

**LinkedIn 403 hatası:**
- Token süresi dolmuş olabilir, yenile
- `w_member_social` scope eksik olabilir

**Post üretimi yavaş:**
- Normal, araştırma 1-2 dk sürer
- Vercel function timeout 120sn — yeterli

## Production İyileştirme (Opsiyonel)

Şu an `pendingPosts` memory'de tutuluyor.
Vercel restart'ta silinir. Kalıcı hale getirmek için:

```bash
# Vercel KV ekle
vercel kv create linkedin-pipeline-kv
```

Sonra `webhook.js`'deki `pendingPosts` objesini KV ile değiştir.
