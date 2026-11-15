# Rota: Kurulum ve Arkadaşlarla Paylaşma Rehberi

Rota, DEHB'li beyin için bekçili bir çalışma uygulaması: hareket ve konum bekçisi, ortak çalışma odaları, bahçe, Park Alanı ve Zaman Çapası.

Bu rehberi **sadece sen** (uygulamayı kuran kişi) bir kez uygularsın. Arkadaşların hiçbir şey kurmaz; sadece senin göndereceğin bağlantıdan uygulamayı yükler (bkz. **5. adım**).

Toplam süre: yaklaşık 30-40 dakika. Bunun yarısı, Android uygulamasının bulutta derlenmesini beklemek.

---

## 0. Gerekenler

| Ne | Nereden | Ücret |
|---|---|---|
| Node.js (LTS sürümü) | [nodejs.org](https://nodejs.org) | Ücretsiz |
| Supabase hesabı (ortak odalar için sunucu) | [supabase.com](https://supabase.com) | Ücretsiz plan yeterli |
| Expo hesabı (Android uygulamasını derlemek için) | [expo.dev/signup](https://expo.dev/signup) | Ücretsiz plan yeterli |

Node.js'i kurduktan sonra terminalde `node -v` yazınca bir sürüm numarası görmelisin.

## 1. Projeyi aç

1. `rota-app.zip` dosyasını bir klasöre çıkar.
2. O klasörde bir terminal aç:
   - **Windows:** Klasörün adres çubuğuna `cmd` yazıp Enter'a bas.
   - **Mac:** Klasöre sağ tıkla, "Klasörde Yeni Terminal" seç.
3. Şunu çalıştır ve bitmesini bekle:

```bash
npm install
```

## 2. Supabase: ortak odaların sunucusu

Arkadaşlarınla aynı odada çalışabilmen için uygulamanın bir sunucuya bağlanması gerekiyor. Bunu bir kez kurarsın, herkes aynı sunucuyu kullanır.

### 2.1 Proje oluştur
1. [supabase.com](https://supabase.com)'da giriş yap (GitHub ya da e-postayla).
2. **New project**'e bas.
   - **Name:** `rota`
   - **Database Password:** Güçlü bir şifre seç ve bir yere not et. Uygulamada kullanılmayacak.
   - **Region:** Central EU (Frankfurt). Türkiye'ye en yakın bölge bu.
3. **Create new project**'e bas ve proje hazırlanana kadar 1-2 dakika bekle.

### 2.2 Tabloları kur
1. Sol menüden **SQL Editor**'a gir, **New query**'ye bas.
2. Projedeki `supabase/schema.sql` dosyasını bir metin düzenleyicide aç, **tamamını** kopyalayıp buraya yapıştır.
3. Sağ alttaki **Run**'a bas. Altta "Success. No rows returned" görmelisin.

### 2.3 Hesapsız girişi aç
Arkadaşların e-posta ya da şifreyle uğraşmasın diye uygulama "anonim giriş" kullanıyor.
1. Sol menüden **Authentication → Sign In / Providers** sayfasına gir.
2. **Allow anonymous sign-ins** seçeneğini aç.
3. **Save changes**'e bas.

### 2.4 Anahtarları uygulamaya yaz
1. Sol menüden **Project Settings** (dişli simgesi) → **API Keys** sayfasına gir.
2. Oradan iki değeri kopyala:
   - **Project URL** (`https://xxxx.supabase.co`). Bazı panellerde bu, **Data API** sayfasında ya da üstteki **Connect** düğmesinin içinde yazar.
   - **Publishable key** (`sb_publishable_` ile başlar). Yoksa **Create new API keys**'e bas.
3. Projedeki `src/config.ts` dosyasını aç ve iki değeri tırnakların içine yapıştır:

```ts
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xxxx.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_xxxxxxxx';
```

> ⚠️ **Secret key** (`sb_secret_…`) ya da **service_role** anahtarını **asla** buraya yazma. O anahtar veritabanındaki tüm kuralları atlar. Publishable key ise uygulamanın içinde durması için tasarlanmıştır; veritabanını tablolardaki güvenlik kuralları (RLS) korur.

### 2.5 Kontrol et
```bash
npm run kontrol
```
Bu komut bağlantıyı, anonim girişi ve tabloları sırayla dener. Hepsi ✅ olmalı. ❌ görürsen hemen altında nasıl düzelteceğin yazar.

## 3. Önce kendin dene (Expo Go)

1. Telefonuna **Expo Go**'yu kur (Play Store / App Store).
2. Bilgisayarda şunu çalıştır:
   ```bash
   npm run baslat
   ```
3. Terminalde çıkan QR kodu okut:
   - **Android:** Expo Go içinden **Scan QR code** ile.
   - **iPhone:** Normal Kamera uygulamasıyla.

Telefon ve bilgisayar **aynı Wi-Fi'da** olmalı. Yurt ya da okul ağı engellerse `npm run tunel` kullan.

**Oda** sekmesinde "Yeni oda kur"a bas. 6 haneli bir kod çıkıyorsa sunucu çalışıyor demektir 🎉

## 4. Android uygulamasını derle (.apk)

Bu adım, arkadaşlarının bilgisayara gerek kalmadan yükleyebileceği gerçek bir uygulama dosyası üretir. "Ekran kapandı mı, başka uygulamaya mı geçildi?" ayrımı da sadece bu sürümde çalışır.

```bash
npx eas-cli@latest login     # Expo hesabınla giriş yap
npm run apk                  # Android uygulamasını bulutta derler
```

- İlk seferde birkaç soru sorar ("Create an EAS project?", "Generate a new Android Keystore?"). Hepsine **Enter**'a basarak varsayılanı seç.
- Derleme bulutta yaklaşık 10-20 dakika sürer. Ücretsiz planda sıra beklemesi olabilir.
- Bitince terminalde ve [expo.dev](https://expo.dev) sayfasında bir **bağlantı ve QR kod** çıkar. Arkadaşlarına göndereceğin şey bu.

> Uygulamada bir şey değiştirirsen (ör. Bekçi mesajları) `npm run apk` ile yeniden derleyip yeni bağlantıyı gönder.

## 5. Arkadaşlarına gönder

### Android kullanan arkadaşlar: en kolayı
1. 4. adımda çıkan bağlantıyı (ya da QR'ı) WhatsApp'tan gönder.
2. Arkadaşın bağlantıyı telefonunda açar ve **Install**'a basar.
3. Telefon "bilinmeyen kaynaklardan yüklemeye izin ver" diye sorarsa izin verir. Uygulama Play Store'dan gelmediği için bu normal.
4. Rota'yı açar ve adını yazar. İzinleri sorar: bildirim, konum ve fiziksel aktivite. Üçüne de **izin ver** demeli.
5. **Oda** sekmesinden senin verdiğin 6 haneli kodla odaya katılır.

### iPhone kullanan arkadaşlar
Apple, App Store dışından uygulama yüklemeye izin vermiyor. İki yol var:

| Yol | Nasıl | Artısı / eksisi |
|---|---|---|
| **Expo Go (ücretsiz)** | Arkadaşın Expo Go'yu kurar. Sen bilgisayarda `npm run tunel` çalıştırırsın, o da terminaldeki QR'ı kamerasıyla okutur. | Hemen olur ama senin bilgisayarında komutun açık kalması gerekir. Ekran/uygulama ayrımı çalışmaz, Bekçi o konuda sessiz kalır. Diğer her şey çalışır. |
| **TestFlight** | Apple Developer hesabı açarsın (yıllık 99 $), sonra `npx eas-cli@latest build -p ios` ve `npx eas-cli@latest submit -p ios` çalıştırırsın. Arkadaşların TestFlight uygulamasıyla davet bağlantından yükler. | Gerçek uygulama, her şey çalışır. Ama ücretli ve Apple incelemesi 1-2 gün sürebilir. |

Deneme aşamasında iPhone'lu arkadaşlar için **Expo Go yolu** yeterli. Uygulama tutarsa TestFlight'a geçersin.

## 6. Odayla çalışma

1. Biriniz **Oda → Yeni oda kur** der, örneğin "Yurt 204 vize kampı". 6 haneli bir kod çıkar.
2. **Kodu paylaş** düğmesiyle kodu WhatsApp grubuna atar.
3. Diğerleri **Oda → Odaya katıl**'dan kodu girer.
4. Artık herkes birbirini canlı görür: kim çalışıyor, kim molada, kim yerinde değil, kim başka uygulamada. Birbirinizi dürtebilir, alkışlayabilir, **Beraber sprint** başlatabilirsiniz. Gün sonunda odanın odak tablosu oluşur.

---

## Bekçi seni nasıl takip eder?
Yer değiştirmek serbest, sadece söylemen yeterli. **Kronometre hiçbir durumda durmaz.**

- **Telefonla kalkarsan:** Adım sayarı yaklaşık 4 adımda (≈ 2-2,5 m) "Nereye?" diye sorar. Ben sekmesinden 3 adıma indirebilirsin. Seçenekler:
  - Yer değiştirdim, devam
  - Kısa ihtiyaç (5 dk)
  - Yemek (30 dk)
  - Kaptırdım
- **Çalışma yeri (konum):** Oturum başında konumun kaydedilir. Kafeden ya da evden çıkarsan sorar. GPS bina içinde 5-20 metre şaştığı için ev içindeki hareketleri adım sayarı yakalar.
- **Telefonu eline alırsan:** Telefon elinde kalırsa sorar. Rota'yı kullanırken sormaz.
- **Telefonu masada bırakıp kalkarsan:** 20-30 dakikada bir **"Orada mısın?"** yoklaması gelir, tek dokunuşla cevaplarsın.
- **Ekranı kapatırsan:** Hiçbir şey sorulmaz.
- **Başka uygulamaya geçersen:** 1 dakika sonra nazik bir bildirim gelir ve odadakiler seni "başka uygulamada" görür.
  - Bu ayrım Android .apk'da ve TestFlight sürümünde çalışır. iPhone'da telefon şifresinin açık olması gerekir.
  - Expo Go'da Bekçi iki durumda da sessiz kalır, sadece 5 dakika sonra nazik bir hatırlatma gönderir.
- Herhangi bir soruya 1 dakika (yoklamada 2 dakika) cevap verilmezse "yerinde değil" sayılırsın. Kopma sayısı artar, odadakiler görür.

## Bahçe
- Her oturumda yeni bir bitki filizlenir ve odaklandıkça büyür: tohum → filiz → fide → tomurcuk → çiçek (45 dk).
- Oturum bitince bitki **Ben** sekmesindeki bahçene dikilir. Tüm adımları bitirirsen çiçek açar.
- **Bitkiler asla solmaz.** Seri yok, ceza yok.
- Geri dönüşler su damlası kazandırır. Her 5 damla bahçene bir kelebek getirir.

## Sorun giderme

| Sorun | Çözüm |
|---|---|
| Oda sekmesinde "anonim giriş kapalı" yazıyor | 2.3 adımını yap. |
| "Veritabanı tabloları yok" | 2.2 adımını yap. `schema.sql`'in **tamamını** yapıştırdığından emin ol. |
| "Anahtar hatalı" | 2.4: Publishable key'i baştan sona tekrar kopyala, başında ya da sonunda boşluk kalmasın. |
| "Çok fazla deneme" | Supabase, aynı internet bağlantısından saatte belirli sayıda yeni anonim girişe izin verir. Bütün yurt aynı Wi-Fi'dan ilk kez giriyorsa bir kısmınız biraz bekleyin ya da mobil veriyle açın. Sınırı Supabase'de **Authentication → Rate Limits**'ten yükseltebilirsin. |
| Telefon QR'ı okutunca açılmıyor | Telefon ve bilgisayar aynı Wi-Fi'da mı? Değilse `npm run tunel` kullan. |
| Adım sayarı sormuyor | Telefon ayarlarında Rota için "Fiziksel aktivite" (Android) ya da "Hareket ve Fitness" (iPhone) izni açık mı? |
| Bildirim gelmiyor | Uygulamanın üstündeki "Bildirimler kapalı" şeridinden aç. Android'de pil tasarrufu modunu Rota için kapat. |

Her değişiklikten sonra kontrol için: `npm run kontrol`

## Bilinen sınırlar
- Uygulama hangi uygulamayı açtığını (Instagram vb.) **göremez**, sadece Rota'dan başka bir uygulamaya geçtiğini bilir. Bu, Android ve iOS'un gizlilik kuralı.
- Odadaki dürtmeler sadece uygulama **açıkken** gelir. Kapalıyken anlık bildirim (push) için ek bir sunucu kurulumu gerekir. Bu bir sonraki sürüme bırakıldı.
- Çalışma verilerin (park listesi, bahçe, istatistikler) kendi telefonunda saklanır. Odalar ve günlük odak tablosu Supabase'de saklanır.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `src/config.ts` | **Supabase bağlantısı: doldurman gereken tek dosya** |
| `supabase/schema.sql` | Veritabanı tabloları ve güvenlik kuralları |
| `scripts/kontrol.mjs` | `npm run kontrol`: kurulum kontrolü |
| `App.tsx` | Ana ekran, sekmeler, bildirim izni |
| `src/session.tsx` | Oturum motoru: sprint, mola, Bekçi akışları |
| `src/room.tsx` | Ortak odalar: canlı durum, dürtme, ortak sprint |
| `src/place.ts`, `src/motion.ts` | Konum ve hareket bekçisi |
| `modules/screen-state` | Ekran kapandı mı / başka uygulamaya mı geçildi (yerel modül) |
| `src/bekci.ts` | Bekçi'nin bütün mesajları (kendi cümlelerini buraya ekleyebilirsin) |
| `src/garden.tsx` | Bahçe, bitkiler, konfeti |
