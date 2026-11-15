import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fill, pick, TONES, Tone } from './bekci';

export type Topic = { t: string; done: boolean };
export type Phase = 'focus' | 'break' | 'await';
export type Session = {
  id: string;
  contract: string;
  topics: Topic[];
  start: number;
  phase: Phase;
  phaseStart: number;
  phaseEnd: number;
  sprintMin: number;
  sprintNo: number;
  kopma: number;
  returns: number;
  focusMs: number;
  lastTick: number;
  hiddenAt: number | null;
  away: boolean;
  /** Başka bir uygulamada (yalnızca kalıcı kurulumda kesin bilinir) */
  elsewhere: boolean;
  /** Yerinde değil / başka uygulamada geçen, odaktan sayılmayan süre (ms) */
  awayMs: number;
  awaySince: number | null;
  elsewhereSince: number | null;
  /** Bu sprint başladığında odak süresi (sprint sonu değerlendirmesi için) */
  sprintFocus0: number;
  /** Son kez "yerinde değil / başka uygulamada" durumundan çıkılan an: aynı süre iki kez düşülmesin */
  lastResume?: number;
  /** Çalışma yeri (GPS) */
  place: { lat: number; lon: number; acc: number } | null;
  placeTried?: boolean;
  nextDeskCheck: number | null;
  bubble: string;
  species: number;
};
export type Crumb = { where: string; next: string; contract: string; topicsLeft: string[]; at: number };
export type ParkItem = { id: string; text: string; kind: 'is' | 'fikir'; at: number; done: boolean };
export type GardenPlant = { id: string; species: number; stage: number; min: number; at: number };
export type Place = { lat: number; lon: number; acc: number };
export type Anchor = { time: string; prep: number; label: string; setAt: number };
export type State = {
  v: 1;
  name: string;
  tone: Tone;
  sprint: number;
  deskId: string;
  deskCheck: boolean;
  placeOn: boolean;
  motion: boolean;
  pickup: boolean;
  stepThr: number;
  noise: boolean;
  draft: { contract: string; topics: string[] };
  session: Session | null;
  crumb: Crumb | null;
  park: ParkItem[];
  strengths: string[];
  anchor: Anchor | null;
  myState: 'idle' | 'done';
  stats: { focusMin: number; sessions: number; returns: number; longestMin: number; done: number };
  roomCode: string | null;
  garden: GardenPlant[];
  drops: number;
};

export function uid(n = 10): string {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export function defaults(): State {
  return {
    v: 1,
    name: '',
    tone: 'kanka',
    sprint: 25,
    deskId: uid(12),
    deskCheck: true,
    placeOn: true,
    motion: true,
    pickup: true,
    stepThr: 4,
    noise: false,
    draft: { contract: '', topics: [] },
    session: null,
    crumb: null,
    park: [],
    strengths: [],
    anchor: null,
    myState: 'idle',
    stats: { focusMin: 0, sessions: 0, returns: 0, longestMin: 0, done: 0 },
    roomCode: null,
    garden: [],
    drops: 0,
  };
}

/* ---- Oturum yardımcıları (saf fonksiyonlar) ---- */
export function cur(s: Session | null): Topic | null {
  if (!s) return null;
  return s.topics.find((t) => !t.done) ?? null;
}
export function left(s: Session | null): Topic[] {
  return s ? s.topics.filter((t) => !t.done) : [];
}
/** Odak süresini şimdiye kadar biriktirir; her durum değişikliğinden önce çağır. */
/** Saat hep akar; ama odak süresi yalnızca yerindeyken ve Rota'dayken (ya da ekran kapalıyken) artar. */
const counting = (s: Session) => s.phase === 'focus' && !s.away && !s.elsewhere;
export function accrue(s: Session, now = Date.now()) {
  if (counting(s)) s.focusMs += Math.max(0, now - s.lastTick);
  s.lastTick = now;
}
export function focusMsNow(s: Session, now = Date.now()) {
  return s.focusMs + (counting(s) ? Math.max(0, now - s.lastTick) : 0);
}
export function awayMsNow(s: Session, now = Date.now()) {
  return (
    (s.awayMs ?? 0) +
    (s.away && s.awaySince ? Math.max(0, now - s.awaySince) : 0) +
    (s.elsewhere && s.elsewhereSince ? Math.max(0, now - s.elsewhereSince) : 0)
  );
}
/** "Yerinde değil" ya da "başka uygulamada" durumunu kapatır: o süreyi uzakta sayar, odağa eklemez. */
export function endAway(s: Session, now = Date.now()) {
  if (s.away) {
    s.awayMs = (s.awayMs ?? 0) + Math.max(0, now - (s.awaySince ?? now));
    s.away = false;
    s.awaySince = null;
  }
  if (s.elsewhere) {
    s.awayMs = (s.awayMs ?? 0) + Math.max(0, now - (s.elsewhereSince ?? now));
    s.elsewhere = false;
    s.elsewhereSince = null;
  }
  s.lastResume = now;
  s.lastTick = now;
}
/** Zaten odak sayılmış bir aralığı geri al (ör. cevapsız kalan bir sorudan beri geçen süre). */
export function uncount(s: Session, from: number, now = Date.now()) {
  const span = Math.max(0, now - from);
  s.focusMs = Math.max(0, s.focusMs - span);
  s.awayMs = (s.awayMs ?? 0) + span;
}
export function say(st: State, kind: keyof (typeof TONES)['kanka'], extra: Record<string, string | number> = {}) {
  const l = left(st.session);
  const c = cur(st.session);
  const list = l.slice(0, 4).map((t) => t.t).join(', ') + (l.length > 4 ? ' …' : '');
  const pool = TONES[st.tone][kind];
  const t = Array.isArray(pool) ? pick(pool) : pool;
  return fill(t, { n: l.length, list, topic: c ? c.t : 'son adım', ...extra });
}
export function ago(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return m + ' dk önce';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' saat önce';
  return Math.round(h / 24) + ' gün önce';
}
export const pad = (n: number) => (n < 10 ? '0' : '') + n;
export const hm = (d: Date) => pad(d.getHours()) + ':' + pad(d.getMinutes());

/* ---- Eski sürümün örnek konularını temizle ----
   İlk sürümler taslağa örnek adımlar (biyoloji) koyuyordu; kullanıcı kendi konusunu yazınca
   bunlar oturuma karışıyordu. Kayıtlı veride kalanları siliyoruz. */
const OLD_EXAMPLES = [
  'Kitabı aç, ilk başlığı oku',
  'Mitoz evrelerini tek sayfada özetle',
  'Mayoz ile mitozun farkını yaz',
];
const isExample = (t: string) => OLD_EXAMPLES.includes(t.trim());
export function cleanExamples(st: State) {
  if (st.draft.contract.includes('(örnek, değiştir)')) st.draft.contract = '';
  st.draft.topics = st.draft.topics.filter((t) => !isExample(t));
  const s = st.session;
  if (s) {
    if (s.contract.includes('(örnek, değiştir)')) s.contract = '';
    const had = s.topics.length;
    s.topics = s.topics.filter((t) => !isExample(t.t));
    if (s.topics.length === 0) s.topics = [{ t: s.contract || 'Çalışmam', done: false }];
    if (s.topics.length !== had && s.topics.every((t) => t.done)) s.topics.push({ t: s.contract || 'Çalışmam', done: false });
    if (/[Mm]itoz|[Mm]ayoz/.test(s.bubble)) s.bubble = '';
  }
  const c = st.crumb;
  if (c) {
    if (c.contract.includes('(örnek, değiştir)')) c.contract = '';
    c.topicsLeft = c.topicsLeft.filter((t) => !isExample(t));
    if (isExample(c.where)) c.where = '';
    if (isExample(c.next)) c.next = '';
    if (!c.where && !c.next && !c.contract && !c.topicsLeft.length) st.crumb = null;
  }
}

/* ---- Depo ---- */
const KEY = 'rota.v1';
type Ctx = { S: State; set: (fn: (draft: State) => void) => void; ref: React.MutableRefObject<State>; loaded: boolean };
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [S, setS] = useState<State>(defaults);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(S);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const p = JSON.parse(raw);
          if (p && p.v === 1) {
            const st: State = { ...defaults(), ...p, noise: false };
            cleanExamples(st);
            if (st.session) {
              st.session.elsewhere = !!st.session.elsewhere;
              st.session.awayMs = st.session.awayMs ?? 0;
              st.session.awaySince = st.session.awaySince ?? (st.session.away ? Date.now() : null);
              st.session.elsewhereSince = st.session.elsewhereSince ?? null;
              st.session.sprintFocus0 = st.session.sprintFocus0 ?? 0;
              st.session.place = st.session.place ?? null;
            }
            ref.current = st;
            setS(st);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(S)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [S, loaded]);

  // Eşzamanlı güncelleme: ref her zaman en son durumu tutar, böylece
  // zamanlayıcılar ve geri çağırmalar eski veriyle çalışmaz.
  const set = useCallback((fn: (d: State) => void) => {
    const d: State = JSON.parse(JSON.stringify(ref.current));
    fn(d);
    ref.current = d;
    setS(d);
  }, []);

  return <StoreCtx.Provider value={{ S, set, ref, loaded }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider yok');
  return c;
}
