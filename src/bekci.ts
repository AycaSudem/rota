export type Tone = 'nazik' | 'kanka' | 'sert';

type Msgs = {
  name: string;
  desc: string;
  start: string[];
  quit: string[];
  away: string[];
  ping: string[];
  done1: string[];
  breakEnd: string[];
  back: string[];
  deskOk: string[];
  deskMiss: string[];
  move: string[];
  pickup: string[];
  place: string[];
};

// Bekçi hiçbir tonda suçlamaz ya da azarlamaz: işe odaklanır, kişiye değil.
// "Sert hoca" bile kısa ve net konuşur ama kırıcı olmaz.
export const TONES: Record<Tone, Msgs> = {
  nazik: {
    name: 'Nazik',
    desc: '"Kısa bir mola mı? Dönünce kaldığın yer hazır 🌱"',
    start: ['Başladın, en zor kısım buydu 🌱 İlk adım: {topic}.', 'Güzel, buradasın. Sadece şuna bak: {topic}.'],
    quit: ['Yorulmuş olabilirsin, bu çok normal. {n} adım kaldı: {list}. İstersen 5 dakika daha deneyelim, istersen mola verelim.'],
    away: ['Tekrar hoş geldin 🌱 Kaldığın yer: {topic}.', 'Döndün, harika. Bitkin seni bekliyordu. Şu an: {topic}.'],
    ping: ['Rota seni bekliyor 🌱 Hazır olduğunda {topic} ile devam edebilirsin.'],
    done1: ['Bir adım bitti, tebrikler 🌼 Sırada: {topic}.', 'Harika gidiyorsun. Sıradaki: {topic}.'],
    breakEnd: ['Mola bitti. Hazır olduğunda {topic} ile devam edelim 🌱'],
    back: ['Tamam, devam. Şu an sadece şu: {topic}.'],
    deskOk: ['Buradasın, harika. Devam: {topic}.'],
    deskMiss: ['Bir yere çıkmış olabilirsin, sorun değil. Döndüğünde haber ver, {topic} bekliyor.'],
    move: ['Yerinden kalktın galiba. Nereye gidiyorsun? Sadece söylemen yeterli.'],
    pickup: ['Telefon elinde gibi. Bir şeye mi bakıyorsun? {topic} seni bekliyor.'],
    place: ['Çalışma yerinden ayrıldın gibi görünüyor. Yeni bir yerde mi çalışıyorsun?'],
  },
  kanka: {
    name: 'Kanka',
    desc: '"Hey, bir yere mi kaçtın? 3 adımın kaldı, beraber bitirelim."',
    start: ['Hadi bakalım, başladık 💪 İlk iş: {topic}.', 'Oturdun ya, gerisi kolay. {topic} ile başla.'],
    quit: ['Hey, daha {n} adımın var: {list}. Biraz daha dayanalım mı? Yorulduysan mola da olur.', 'Bırakmadan önce bir düşün: {list} seni bekliyor. 5 dakika daha?'],
    away: ['Hoş geldin kanka 👋 Kaldığın yer: {topic}.', 'Döndün! Hadi kaldığımız yerden: {topic}.'],
    ping: ['Hey, bir yere mi kaçtın? 👀 {n} adımın kaldı, beraber bitirelim.', 'Kanka, {topic} seni özledi 🌱 Hazırsan dön.'],
    done1: ['Oha, bir tane bitti 🎉 Sıradaki: {topic}.', 'İşte bu! Şimdi şu: {topic}.'],
    breakEnd: ['Mola bitti kanka. Hazırsan {topic} ile devam 💪'],
    back: ['Aferin, devam. {topic}.'],
    deskOk: ['Buradasın, süper. Devam: {topic}.'],
    deskMiss: ['Ses yok kanka 👀 Döndüğünde haber ver, {topic} bekliyor.'],
    move: ['Hop, nereye? 😄 Yer mi değiştirdin, mola mı? Söyle yeter.', 'Kalktın kanka. Tuvalet mi, yatak mı, mola mı?'],
    pickup: ['Telefonu eline aldın 👀 Bir şeye mi bakıyorsun? {topic} bekliyor.'],
    place: ['Çalışma yerinden çıktın gibi. Kafeye mi geçtin, mola mı?'],
  },
  sert: {
    name: 'Sert hoca',
    desc: '"Kısa ve net: 3 adım kaldı. Devam."',
    start: ['Başla. {topic}.', 'Süre işliyor. {topic}.'],
    quit: ['{n} adım kaldı: {list}. 5 dakika daha dene.', 'Bitmeye yakınsın. {topic}. Devam.'],
    away: ['Hoş geldin. Devam: {topic}.'],
    ping: ['{n} adım kaldı. Hazır olduğunda dön: {topic}.'],
    done1: ['Bir tane bitti. Sıradaki: {topic}.', 'Tamam. Sıradaki: {topic}.'],
    breakEnd: ['Mola bitti. {topic}.'],
    back: ['Doğru karar. {topic}.'],
    deskOk: ['Tamam. {topic}.'],
    deskMiss: ['Yerinde değilsin. Döndüğünde devam: {topic}.'],
    move: ['Kalktın. Nereye?'],
    pickup: ['Telefon elinde. {topic} bekliyor.'],
    place: ['Çalışma yerinden ayrıldın. Nereye?'],
  },
};

export const STRENGTHS: [string, string][] = [
  ['Hiperodak', 'Uzun oturumlardan önce Zaman Çapası\'nı kur. Hiperodağın tadını çıkar, saati Rota tutsun.'],
  ['Yaratıcılık', 'Park ettiğin fikirler Fikir Defteri\'nde birikiyor. Ayda bir göz at, birbirine bağla.'],
  ['Girişimcilik', 'Fikir Defteri\'nden bir fikri seç ve 1 haftalık mini proje yap: tek hedef, tek ölçü.'],
  ['Kriz yönetimi', 'Sprint\'ler senin kontrollü mini krizlerin. Erteleme başladıysa 15 dakikalık sprint seç.'],
  ['Dayanıklılık', 'Geri dönüş sayın: {returns}. Her kopuştan dönmek bir kas, sen onu çalıştırıyorsun.'],
  ['Yüksek enerji', 'Molada oturma, kalk: 20 squat, bir tur yürüyüş ya da bir şarkı boyunca dans.'],
];

export function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

export function fill(t: string, v: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (_m, k) => (v[k] != null ? String(v[k]) : ''));
}
