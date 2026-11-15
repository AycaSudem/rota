// Sıcak, renkli ve sakin: lavanta sisi üzerinde nane, güneş, mercan ve gökyüzü.
// Her kartın kendi rengi var; böylece ekran bir tablo değil, bir çalışma köşesi gibi görünür.
export const C = {
  bg: '#F3EFFF',
  surface: '#FFFFFF',
  surface2: '#F8F6FF',
  ink: '#2A2346',
  muted: '#6C6690',
  line: '#E3DCFA',

  accent: '#7B61FF', // ana renk: lavanta-mor
  accentDeep: '#5B43E0',
  accentSoft: '#ECE7FF',
  onAccent: '#FFFFFF',

  mint: '#22B07D',
  mintSoft: '#DCF5EA',
  sun: '#F5A524',
  sunDeep: '#A8670A',
  sunSoft: '#FFF1CF',
  coral: '#FF7363',
  coralSoft: '#FFE4DF',
  sky: '#3B9EF0',
  skySoft: '#DEEFFF',

  ok: '#22B07D',
  danger: '#E5484D',
};

export const R = 22;

/** Nunito: yuvarlak, sıcak bir yazı tipi. Ağırlıklar bir kademe kalın eşlenir. */
export const FONT: Record<number, string> = {
  400: 'Nunito_500Medium',
  500: 'Nunito_600SemiBold',
  600: 'Nunito_700Bold',
  700: 'Nunito_800ExtraBold',
  800: 'Nunito_900Black',
};
