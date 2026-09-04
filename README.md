# CyberMind Analytics

CyberMind Analytics, selfie fotoğrafınız üzerinden yapay zeka destekli **psikolojik durum analizi** yapan, siber punk / bilim-kurgu temalı bir HUD (Head-Up Display) arayüzüne sahip tam kapsamlı bir web uygulamasıdır. Tarayıcınızın kamerasıyla anlık bir selfie çekersiniz; yapay zeka modeli yüzünüzdeki mikro ifadeleri analiz ederek anlık ruh halinizi, stres seviyenizi, yorgunluğunuzu, mutluluğunuzu, odaklanma düzeyinizi **ve ifadenizin ne kadar doğal/anlık mı yoksa poz verilmiş/yapmacık mı olduğunu** saniyeler içinde ekrana yansıtır.

> **⚠️ Önemli Uyarı:** CyberMind Analytics tamamen **eğlence ve kişisel farkındalık amaçlıdır**. Sunulan sonuçlar tıbbi, klinik veya profesyonel bir psikolojik teşhis/değerlendirme **niteliği taşımaz** ve bir uzmana danışmanın yerini **tutmaz**. Bu uyarı, sonuç panelinde ve uygulama arayüzünde de kullanıcıya ayrıca gösterilir.

## Özellikler

- 📸 Tarayıcı üzerinden canlı kamera akışı ile selfie yakalama (ön/arka kamera geçişi destekli).
- 🛰️ "Yüzü Tara" butonuna basıldığında çalışan animasyonlu lazer tarama efekti (Framer Motion).
- 🧠 Yapay zeka destekli yüz mikro-ifade analizi: birincil sağlayıcı olarak **Google Gemini** (`gemini-flash-latest`), tüm anahtarlar başarısız olursa otomatik olarak **Groq** (`openai/gpt-oss-120b`) yedek sağlayıcısına geçiş.
- 🕵️ **Doğallık / özgünlük analizi:** model, ifadenin göz bölgesi katılımı, kas gerginliği/simetrisi ve kameraya karşı "poz" belirtileri gibi somut ipuçlarına bakarak ifadenin **doğal/anlık mı yoksa poz verilmiş/performatif mi** olduğunu değerlendirir; bu yargı diğer skorlara ve "Analiz Notu" metnine de yansıtılır.
- 🔁 Her sağlayıcı için birden fazla API anahtarı arasında otomatik rotasyon: bir anahtar kimlik doğrulama hatası, hız sınırı (429) veya sunucu hatası (5xx) verirse sıradaki anahtar otomatik olarak denenir.
- 🎛️ Sonuç HUD paneli: ruh halini gösteren yarım daire gösterge (radial gauge), Stres Seviyesi / Yorgunluk / Anlık Mutluluk / Odaklanma / **Doğallık** için 0'dan başlayarak animasyonla dolan yüzde çubukları ve nitel etiketler (Düşük / Orta / Yüksek vb.), modelin gözlemlediği mikro ifadeleri açıklayan "Analiz Notu" kutusu ve panel içinde ayrıca gösterilen eğlence/farkındalık amaçlı kullanım uyarısı.
- 🌌 Karanlık tema, camsı (glassmorphism) paneller, neon vurgular ve ızgara arka plan ile tamamen Türkçe kullanıcı arayüzü.
- 🔒 Tüm API anahtarları yalnızca sunucu tarafında, ortam değişkenleri (environment variables) üzerinden kullanılır; istemci tarafına veya derlenen (bundle) koda asla gönderilmez.

## Teknoloji Yığını

- [Next.js 14](https://nextjs.org/) — App Router
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) — karanlık tema ve glassmorphism yardımcı sınıfları
- [Framer Motion](https://www.framer.com/motion/) — HUD geçişleri, tarama animasyonu, çubuk animasyonları
- [Lucide React](https://lucide.dev/) — ikon seti
- [react-webcam](https://github.com/mozmorris/react-webcam) — tarayıcı kamera entegrasyonu

## Proje Yapısı

```
cybermind-analytics/
├── app/
│   ├── api/analyze/route.ts   # Gemini/Groq rotasyonlu analiz API rotası
│   ├── globals.css            # Glassmorphism ve HUD yardımcı stilleri
│   ├── layout.tsx             # Kök layout, fontlar, Türkçe metadata
│   └── page.tsx               # Ana istemci bileşeni (kamera + sonuç HUD'u)
├── components/
│   ├── RadialGauge.tsx         # Yarım daire ruh hali göstergesi
│   ├── ScanOverlay.tsx         # Lazer tarama animasyon katmanı
│   └── StatBar.tsx             # Animasyonlu yüzde çubuğu bileşeni
├── lib/
│   ├── analysis-schema.ts      # LLM çıktısının JSON sözleşmesine göre doğrulanması
│   ├── gemini-client.ts        # Gemini API istemcisi + çoklu anahtar rotasyonu
│   ├── groq-client.ts          # Groq API istemcisi (yedek) + çoklu anahtar rotasyonu
│   ├── prompt.ts                # Sıkı JSON çıktısı isteyen sistem promptları
│   ├── types.ts                 # Paylaşılan TypeScript tipleri
│   └── ui-helpers.ts             # Nitel etiket ve gösterge hesaplama yardımcıları
├── .env.example                 # Ortam değişkeni adları (gerçek değer içermez)
├── tailwind.config.ts
└── package.json
```

## Kurulum (Yerel Geliştirme)

1. Bağımlılıkları yükleyin:

   ```bash
   npm install
   ```

2. Ortam değişkenlerini tanımlayın: `.env.example` dosyasını `.env.local` olarak kopyalayıp gerçek API anahtarlarınızı girin.

   ```bash
   cp .env.example .env.local
   ```

3. Geliştirme sunucusunu başlatın:

   ```bash
   npm run dev
   ```

4. Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın. Kamera erişimi isteyen bir izin penceresi çıkacaktır; selfie tarama özelliğinin çalışması için kamera iznini onaylamanız gerekir.

> **Not:** Kamera erişimi, tarayıcı güvenlik kısıtlamaları nedeniyle yalnızca `https://` bağlantılarında veya `http://localhost` üzerinde çalışır.

## Ortam Değişkenleri

Uygulamanın backend analiz rotası (`app/api/analyze/route.ts`) aşağıdaki ortam değişkenlerini okur. Tümü **yalnızca sunucu tarafında** kullanılır ve istemciye asla gönderilmez:

| Değişken       | Açıklama                                                             |
| -------------- | --------------------------------------------------------------------- |
| `GEMINI_KEY_1` … `GEMINI_KEY_5` | Google Gemini için birincil ve yedek API anahtarları (`gemini-flash-latest` modeli). Anahtarlardan biri başarısız olursa sıradaki otomatik olarak denenir. |
| `GROQ_KEY_1` … `GROQ_KEY_5`     | Gemini'nin tüm anahtarları başarısız olduğunda devreye giren Groq yedek sağlayıcısı için API anahtarları (`openai/gpt-oss-120b` modeli). |

Gerçek anahtar değerleri hiçbir zaman depoya (repository) işlenmez; yalnızca isim şablonlarını içeren `.env.example` dosyası sürüm kontrolüne dahildir. Canlı ortamda bu değişkenler doğrudan Vercel proje ayarlarında **şifrelenmiş (encrypted) Production ortam değişkenleri** olarak tanımlanır.

## Dağıtım (Deployment) Notları

- Proje, [Vercel](https://vercel.com/) üzerinde bir Next.js uygulaması olarak dağıtılacak şekilde tasarlanmıştır; ek bir sunucu yapılandırması gerekmez.
- Dağıtım öncesinde yukarıdaki tüm ortam değişkenlerinin Vercel proje ayarlarında **Production** ortamı için tanımlanmış olması gerekir.
- API rotası (`/api/analyze`) Node.js çalışma zamanında (`runtime = "nodejs"`) çalışır ve isteğe bağlı olarak uzun süren analiz istekleri için `maxDuration` değeri artırılmıştır.
- Vercel projesinin varsayılan **Deployment Protection / SSO** duvarının kapalı olduğundan emin olun; aksi hâlde dağıtılan bağlantı, tarayıcıdan doğrudan erişildiğinde bir kimlik doğrulama sayfasına yönlendirir ve uygulama herkese açık olarak görüntülenemez.
- `npm run build` komutu, dağıtım öncesi yerel bir üretim derlemesi doğrulaması için kullanılabilir.

## Gizlilik ve Güvenlik

- Yakalanan selfie görüntüsü yalnızca analiz isteği sırasında geçici olarak işlenir; uygulama tarafında kalıcı olarak saklanmaz.
- Tüm yapay zeka sağlayıcı anahtarları sunucu tarafı ortam değişkenleri olarak tutulur ve istemci tarafı JavaScript koduna asla dahil edilmez.
- API rotası, istemciden gelen görüntü verisini boyut ve biçim açısından doğrular ve yalnızca önceden tanımlanmış JSON sözleşmesine uyan sonuçları istemciye döndürür.

## Lisans

Bu proje, CyberMind Analytics ürün ekibi için özel olarak geliştirilmiştir.