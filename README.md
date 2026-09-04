# CyberMind Analytics

CyberMind Analytics, 5-10 saniyelik bir selfie **videosu** üzerinden hem gerçek bilgisayarlı görü ölçümlerini hem de yapay zeka yorumunu birleştiren, siber punk / bilim-kurgu temalı bir HUD (Head-Up Display) arayüzüne sahip tam kapsamlı bir **biyometrik yüz analizi** web uygulamasıdır. Tarayıcınızın kamerasıyla kısa bir video kaydedersiniz; bu sırada tarayıcınızda çalışan bir yüz-işaretleyici modeli baş pozunuzu, göz kırpmanızı, bakış yönünüzü, yüz asimetrinizi ve nabız dalgalanmanızı **gerçekten ölçer**; aynı anda video, bu gerçek ölçümlerle birlikte yapay zekaya gönderilerek mikro ifadeleriniz, duygusal durumunuz ve bilişsel yükünüz üzerine derinlemesine bir rapor üretilir.

> **⚠️ Önemli Uyarı:** CyberMind Analytics tamamen **eğlence ve kişisel farkındalık amaçlıdır**. Sunulan sonuçlar tıbbi, klinik veya profesyonel bir psikolojik teşhis/değerlendirme **niteliği taşımaz** ve bir uzmana danışmanın yerini **tutmaz**. Nabız (rPPG) tahmini deneysel ve laboratuvar doğruluğunda değildir; FACS/mikro ifade ve pupillometri yorumları yapay zekanın görsel izlenimidir. Bu uyarı, sonuç panelinde ve uygulama arayüzünde de kullanıcıya ayrıca gösterilir.

## "Ölçülen" ve "AI Tahmini" Ayrımı — Dürüstlük Mimarisi

Bu uygulamanın temel tasarım ilkesi, gerçekten ölçülebilen veriyle yapay zekanın yorumunu **asla birbirine karıştırmamaktır**:

- 🟢 **Ölçülen (gerçek veri, LLM'siz):** Baş pozu (pitch/yaw/roll) ve stabilite skoru, göz kırpma sayısı/oranı, kameraya bakış yüzdesi, sol-sağ yüz asimetri skoru, deneysel rPPG nabız tahmini ve genel sinyal kalitesi/güven skoru — bunların tamamı, video kaydı sırasında **tarayıcınızda**, yapay zeka hiç devreye girmeden, `@mediapipe/tasks-vision` yüz-işaretleyici modeli ve klasik sinyal işleme (EAR göz açıklık oranı, Goertzel algoritması ile frekans arama, dönüşüm matrisi ayrıştırma) ile hesaplanır.
- 🟣 **AI Tahmini (yapay zeka yorumu):** Ruh hali, stres/yorgunluk/mutluluk/odaklanma/doğallık skorları ve 4 bölümlük derinlemesine rapor (Fiziksel ve Fizyolojik Durum, Duygusal ve Psikolojik Analiz, Bilişsel Yük ve Odak, Genel Değerlendirme) yapay zeka modeli tarafından üretilir — ancak model, yukarıdaki gerçek ölçülen verilerle **tutarlı** olacak şekilde yönlendirilir; ölçülen veriyle çelişen veya onu görmezden gelen bir yorum üretmemesi için sistem promptunda açıkça talimatlandırılmıştır.

Arayüzde her değer, yeşil "Ölçülen" veya mor "AI Tahmini" rozetiyle açıkça etiketlenir; bu ayrım hiçbir yerde bulanıklaştırılmaz.

## Özellikler

- 🎥 Tarayıcı üzerinden 5-10 saniyelik canlı kamera **video kaydı** (geri sayım + kayıt sırasında ilerleme göstergesi ve "sabit durun, kameraya bakın, normal ışıkta kalın" yönlendirmesi ile).
- 🧬 **Gerçek zamanlı, LLM'siz bilgisayarlı görü:** `@mediapipe/tasks-vision` Face Landmarker ile kayıt sırasında her karede yüz işaretleyicileri çıkarılır ve şu gerçek metrikler hesaplanır:
  - Baş pozu (pitch/yaw/roll) ortalaması ve varyanstan türetilen stabilite/mikro-titreme skoru (yüz dönüşüm matrisinden ayrıştırılır).
  - Göz kırpma sayısı ve dakika başı oranı (klasik EAR — Eye Aspect Ratio — göz açıklık oranı formülüyle).
  - Kameraya bakış yüzdesi (iris işaretleyicilerinin göz köşelerine göre konumundan).
  - Sol-sağ yüz asimetri skoru (simetrik işaretleyici çiftlerinin burun köprüsüne uzaklık farkından).
  - **Deneysel rPPG nabız tahmini:** alından bölgesindeki yeşil kanal renk dalgalanmasından, Goertzel algoritmasıyla 42-180 BPM aralığında baskın frekans aranarak hesaplanır; sinyal yetersizse dürüstçe "Yetersiz Sinyal" gösterilir, uydurma bir sayı üretilmez.
  - Genel sinyal kalitesi/güven skoru (yüzün ne kadarının net tespit edildiği, kare sayısı ve baş stabilitesinden).
- 🧠 **Çok sağlayıcılı yapay zeka analizi:** birincil sağlayıcı **Google Gemini** (`gemini-flash-latest`) — videonun tamamını doğrudan alıp gerçek zamansal veriyi görür; tüm Gemini anahtarları başarısız olursa videodan çıkarılan 3-5 temsili kare **Groq** (`openai/gpt-oss-120b`) yedek sağlayıcısına gönderilir (Groq video kabul etmez, bu yüzden temsili kareler kullanılır); o da başarısız olursa, ölçülen gerçek verilerle tutarlı metin-tabanlı bir son yedek devreye girer.
- 🔁 Her sağlayıcı için birden fazla API anahtarı arasında otomatik rotasyon: bir anahtar kimlik doğrulama hatası, hız sınırı (429) veya sunucu hatası (5xx) verirse sıradaki anahtar otomatik olarak denenir.
- 🕵️ **Doğallık / özgünlük analizi:** model, ifadenin göz bölgesi katılımı, kas gerginliği/simetrisi ve kameraya karşı "poz" belirtileri gibi somut ipuçlarına bakarak ifadenin doğal/anlık mı yoksa poz verilmiş/performatif mi olduğunu değerlendirir.
- 🎛️ Zengin sonuç HUD paneli: ruh hali göstergesi (radial gauge), hızlı özet yüzde çubukları (Stres / Yorgunluk / Mutluluk / Odaklanma / Doğallık), **Ölçülen Veriler** ızgarası (6 gerçek metrik kartı) ve **Derinlemesine Biyometrik Rapor** (6 kategoriyi kapsayan 4 bölümlük AI analiz metni), her biri kaynağına göre net biçimde etiketlenmiş.
- 🌌 Karanlık tema, camsı (glassmorphism) paneller, neon vurgular ve ızgara arka plan ile tamamen Türkçe kullanıcı arayüzü.
- 🔒 Tüm API anahtarları yalnızca sunucu tarafında, ortam değişkenleri (environment variables) üzerinden kullanılır; istemci tarafına veya derlenen (bundle) koda asla gönderilmez.

## Teknoloji Yığını

- [Next.js 14](https://nextjs.org/) — App Router
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) — karanlık tema ve glassmorphism yardımcı sınıfları
- [Framer Motion](https://www.framer.com/motion/) — HUD geçişleri, tarama/kayıt animasyonları, çubuk animasyonları
- [Lucide React](https://lucide.dev/) — ikon seti
- [react-webcam](https://github.com/mozmorris/react-webcam) — tarayıcı kamera entegrasyonu (canlı önizleme)
- [`@mediapipe/tasks-vision`](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) — tarayıcıda çalışan, LLM'siz gerçek yüz-işaretleyici/baş pozu hesaplama motoru
- `MediaRecorder` (Web API) — video kaydı; `Canvas`/`getImageData` — rPPG piksel örnekleme

## Proje Yapısı

```
cybermind-analytics/
├── app/
│   ├── api/analyze/route.ts   # Gemini (video) / Groq (kare) rotasyonlu analiz API rotası
│   ├── globals.css            # Glassmorphism ve HUD yardımcı stilleri
│   ├── layout.tsx             # Kök layout, fontlar, Türkçe metadata
│   └── page.tsx               # Ana istemci bileşeni (video kaydı + canlı ölçüm + sonuç HUD'u)
├── components/
│   ├── RadialGauge.tsx         # Yarım daire ruh hali göstergesi
│   ├── ScanOverlay.tsx         # Analiz sırasında lazer tarama animasyon katmanı
│   ├── RecordingOverlay.tsx    # Geri sayım ve video kaydı sırasındaki HUD katmanı
│   ├── StatBar.tsx             # Animasyonlu yüzde çubuğu bileşeni (hızlı özet)
│   ├── MeasuredStat.tsx        # "Ölçülen" rozetli gerçek metrik kartı
│   └── ReportSection.tsx       # "AI Tahmini" rozetli derinlemesine rapor bölümü
├── lib/
│   ├── face-metrics.ts         # Tarayıcıda çalışan, LLM'siz bilgisayarlı görü motoru (MediaPipe + EAR + Goertzel rPPG)
│   ├── analysis-schema.ts      # LLM çıktısının JSON sözleşmesine göre doğrulanması
│   ├── gemini-client.ts        # Gemini API istemcisi (video girişi) + çoklu anahtar rotasyonu
│   ├── groq-client.ts          # Groq API istemcisi (çoklu kare yedek) + çoklu anahtar rotasyonu
│   ├── prompt.ts                # 6 kategori / 4 bölümlük rapor için sistem promptları + ölçüm verisi enjeksiyonu
│   ├── types.ts                 # Paylaşılan TypeScript tipleri (QuickStats, DeepReport, MeasuredMetrics)
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

4. Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın. Kamera erişimi isteyen bir izin penceresi çıkacaktır; video tarama özelliğinin çalışması için kamera iznini onaylamanız gerekir. Yüz-işaretleyici modeli (`@mediapipe/tasks-vision`) ilk kullanımda bir CDN'den indirilir; bu nedenle ilk taramadan önce internet bağlantısı gereklidir.

> **Not:** Kamera erişimi, tarayıcı güvenlik kısıtlamaları nedeniyle yalnızca `https://` bağlantılarında veya `http://localhost` üzerinde çalışır.

## Ortam Değişkenleri

Uygulamanın backend analiz rotası (`app/api/analyze/route.ts`) aşağıdaki ortam değişkenlerini okur. Tümü **yalnızca sunucu tarafında** kullanılır ve istemciye asla gönderilmez:

| Değişken       | Açıklama                                                             |
| -------------- | --------------------------------------------------------------------- |
| `GEMINI_KEY_1` … `GEMINI_KEY_5` | Google Gemini için birincil ve yedek API anahtarları (`gemini-flash-latest` modeli, video girişini doğrudan destekler). Anahtarlardan biri başarısız olursa sıradaki otomatik olarak denenir. |
| `GROQ_KEY_1` … `GROQ_KEY_5`     | Gemini'nin tüm anahtarları başarısız olduğunda devreye giren Groq yedek sağlayıcısı için API anahtarları (`openai/gpt-oss-120b` modeli, videodan çıkarılan temsili kareleri ve son çare olarak metin-tabanlı isteği işler). |

Gerçek anahtar değerleri hiçbir zaman depoya (repository) işlenmez; yalnızca isim şablonlarını içeren `.env.example` dosyası sürüm kontrolüne dahildir. Canlı ortamda bu değişkenler doğrudan Vercel proje ayarlarında **şifrelenmiş (encrypted) Production ortam değişkenleri** olarak tanımlanır.

## Dağıtım (Deployment) Notları

- Proje, [Vercel](https://vercel.com/) üzerinde bir Next.js uygulaması olarak dağıtılacak şekilde tasarlanmıştır; ek bir sunucu yapılandırması gerekmez.
- Dağıtım öncesinde yukarıdaki tüm ortam değişkenlerinin Vercel proje ayarlarında **Production** ortamı için tanımlanmış olması gerekir.
- API rotası (`/api/analyze`) Node.js çalışma zamanında (`runtime = "nodejs"`) çalışır ve video analizinin süresi göz önünde bulundurularak `maxDuration = 60` olarak ayarlanmıştır.
- **Video boyutu kısıtı:** Vercel Serverless Fonksiyonları'nın istek gövdesi için platform genelinde ~4.5MB'lık sabit bir üst sınırı vardır. Bu nedenle istemci tarafında video, kısa süre (varsayılan 7 saniye) ve düşük bit hızıyla (~500 kbps) kaydedilir; bu, tipik bir klibi rahatlıkla birkaç yüz KB ile 1MB arasında tutar ve hem Vercel'in hem de Gemini'nin satır içi (inline) veri sınırlarının güvenle altında kalır.
- Vercel projesinin varsayılan **Deployment Protection / SSO** duvarının kapalı olduğundan emin olun; aksi hâlde dağıtılan bağlantı, tarayıcıdan doğrudan erişildiğinde bir kimlik doğrulama sayfasına yönlendirir ve uygulama herkese açık olarak görüntülenemez.
- `npm run build` komutu, dağıtım öncesi yerel bir üretim derlemesi doğrulaması için kullanılabilir.

## Doğruluk ve Ölçüm Kalitesi Hakkında Dürüst Notlar

- "Ölçülen" etiketli veriler gerçek hesaplamalardır, ancak standart bir web kamerasıyla elde edildikleri için laboratuvar/klinik cihazlarla aynı hassasiyette **değildir**. Özellikle rPPG nabız tahmini; ışık koşullarına, kameranın sıkıştırma kalitesine ve hareketliliğe karşı oldukça hassastır ve düşük güven skoruyla birlikte yorumlanmalıdır.
- Baş hareketi, düşük ışık veya yüzün kısmen kapalı olması, ölçülen verilerin güvenilirliğini (Sinyal Kalitesi skorunu) düşürür; bu durumda uygulama sayı uydurmak yerine düşük güven veya "yetersiz sinyal" bildirir.
- "AI Tahmini" etiketli tüm alanlar (ruh hali, duygusal durum, FACS/mikro ifade yorumu, pupillometri izlenimi, bilişsel yük) bir yapay zeka modelinin görsel yorumudur; gerçek bir laboratuvar ölçümü değildir.

## Gizlilik ve Güvenlik

- Yakalanan video yalnızca analiz isteği sırasında geçici olarak işlenir; uygulama tarafında kalıcı olarak saklanmaz.
- Yüz-işaretleyici hesaplamalarının tamamı tarayıcıda (istemci tarafında) çalışır; ham video görüntü karesi hiçbir zaman bu hesaplama için harici bir sunucuya gönderilmez — yalnızca özetlenmiş sayısal metrikler ve (analiz için) videonun kendisi API'ye iletilir.
- Tüm yapay zeka sağlayıcı anahtarları sunucu tarafı ortam değişkenleri olarak tutulur ve istemci tarafı JavaScript koduna asla dahil edilmez.
- API rotası, istemciden gelen video/kare verisini ve ölçüm nesnesini boyut, biçim ve makul aralık açısından doğrular ve yalnızca önceden tanımlanmış JSON sözleşmesine uyan sonuçları istemciye döndürür.

## Lisans

Bu proje, CyberMind Analytics ürün ekibi için özel olarak geliştirilmiştir.