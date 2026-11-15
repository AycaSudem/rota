import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { classifyLeave, precise } from '../modules/screen-state/src';
import { Plant, SPECIES, stageFor, useConfetti } from './garden';
import { MoveKind, useMotionGuard } from './motion';
import { cancel, cancelSession, initNotifications, schedule } from './notify';
import { capturePlace, usePlaceGuard } from './place';
import { useRoom } from './room';
import { accrue, awayMsNow, cur, endAway, focusMsNow, hm, left, say, Session, State, uid, uncount, useStore } from './store';
import { C, FONT } from './theme';
import { Input, Seg, T, useNav, useSheet, useToast } from './ui';

type Actions = {
  startSession: () => void;
  topicDone: () => void;
  quit: () => void;
  takeBreak: () => void;
  park: () => void;
  toggleNoise: () => void;
};
const SessionCtx = createContext<Actions | null>(null);
export const useSession = () => {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('SessionProvider yok');
  return c;
};

const nextCheckAt = () => Date.now() + (20 + Math.random() * 10) * 60000;

/* ---------- Sheet gövdeleri ---------- */
function BekciSays({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: C.sunSoft, borderColor: '#FFDF94', borderWidth: 1.5, borderRadius: 18, padding: 14 }}>
      <Text style={{ color: C.sunDeep, fontFamily: FONT[800], fontSize: 12, letterSpacing: 1 }}>BEKÇİ</Text>
      <T style={{ marginTop: 3 }}>{text}</T>
    </View>
  );
}
function Countdown({ until, onEnd }: { until: number; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until && !fired.current) {
        fired.current = true;
        onEnd();
      }
    }, 500);
    return () => clearInterval(id);
  }, [until, onEnd]);
  const r = Math.max(0, until - now);
  return (
    <Text style={{ color: C.accent, fontSize: 40, fontFamily: FONT[800], textAlign: 'center', fontVariant: ['tabular-nums'] }}>
      {Math.floor(r / 60000)}:{String(Math.floor((r % 60000) / 1000)).padStart(2, '0')}
    </Text>
  );
}
function FormBody({ fields, vals }: { fields: { key: string; label: string; placeholder?: string; initial?: string }[]; vals: Record<string, string> }) {
  return (
    <View style={{ gap: 8 }}>
      {fields.map((f, i) => (
        <View key={f.key} style={{ gap: 6 }}>
          <T bold small>
            {f.label}
          </T>
          <Input autoFocus={i === 0} defaultValue={f.initial} placeholder={f.placeholder} onChangeText={(v) => (vals[f.key] = v)} />
        </View>
      ))}
    </View>
  );
}
function ParkBody({ vals }: { vals: { text: string; kind: 'is' | 'fikir' } }) {
  const [kind, setKind] = useState<'is' | 'fikir'>('is');
  return (
    <View style={{ gap: 10 }}>
      <Input autoFocus placeholder="Aklına ne geldi?" onChangeText={(v) => (vals.text = v)} />
      <Seg
        value={kind}
        options={[
          ['is', 'Yapılacak iş'],
          ['fikir', 'Fikir'],
        ]}
        onChange={(k) => {
          setKind(k);
          vals.kind = k;
        }}
      />
    </View>
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { S, set, ref } = useStore();
  const sheet = useSheet();
  const toast = useToast();
  const room = useRoom();
  const { setTab } = useNav();
  const confetti = useConfetti();
  const noise = useAudioPlayer(require('../assets/brown.wav'));
  const bell = useAudioPlayer(require('../assets/chime.wav'));
  const checkDeadline = useRef<number | null>(null);
  const anchorFired = useRef<string>('');

  /* ---- yardımcılar ---- */
  const feedback = (strong = false) => {
    try {
      bell.seekTo(0);
      bell.play();
    } catch {}
    Haptics.notificationAsync(strong ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(() => {});
  };
  const water = () => toast('💧 +1 su damlası. Geri dönmek bahçeni sular.', undefined, 3500);
  const mut = (fn: (s: Session, d: State) => void) =>
    set((d) => {
      if (d.session) fn(d.session, d);
    });
  const bubble = (text: string) => mut((s) => (s.bubble = text));
  const sayNow = (kind: Parameters<typeof say>[1], extra?: Record<string, string | number>) => say(ref.current, kind, extra);

  const scheduleAll = () => {
    const st = ref.current;
    const s = st.session;
    if (!s) return;
    if (s.phase === 'focus') schedule('phase', s.phaseEnd, 'Sprint bitti ⏱️', 'Rota\'yı aç, nasıl geçtiğine bakalım. Mola mı, devam mı?');
    else if (s.phase === 'break') schedule('phase', s.phaseEnd, 'Mola bitti 🌱', say(st, 'breakEnd'));
    else cancel('phase');
    if (st.deskCheck && s.nextDeskCheck && s.phase === 'focus') schedule('desk', s.nextDeskCheck, 'Orada mısın? 🌱', 'Rota\'yı açıp "Buradayım"a dokunman yeterli.');
    else cancel('desk');
  };

  /* ---- oturum akışı ---- */
  const startSession = () => {
    const st = ref.current;
    let topics = st.draft.topics.map((t) => t.trim()).filter(Boolean);
    const contract = st.draft.contract.trim();
    if (!topics.length && contract) topics = [contract];
    if (!topics.length) {
      toast('Ne çalışacağını yaz. Tek satır bile yeter.');
      return;
    }
    initNotifications();
    const now = Date.now();
    set((d) => {
      d.session = {
        id: uid(),
        contract,
        topics: topics.map((t) => ({ t, done: false })),
        start: now,
        phase: 'focus',
        phaseStart: now,
        phaseEnd: now + d.sprint * 60000,
        sprintMin: d.sprint,
        sprintNo: 1,
        kopma: 0,
        returns: 0,
        focusMs: 0,
        lastTick: now,
        hiddenAt: null,
        away: false,
        elsewhere: false,
        awayMs: 0,
        awaySince: null,
        elsewhereSince: null,
        sprintFocus0: 0,
        place: null,
        nextDeskCheck: d.deskCheck ? nextCheckAt() : null,
        bubble: '',
        species: Math.floor(Math.random() * SPECIES.length),
      };
      d.crumb = null;
      d.draft = { contract: '', topics: [] };
      d.myState = 'idle';
      d.session!.bubble = say(d, 'start') + (d.motion ? ' Telefonu bir yere bırak; kalkarsan sorarım.' : '');
    });
    scheduleAll();
    setTab('calis');
    if (ref.current.placeOn) {
      capturePlace().then((p) =>
        mut((s) => {
          s.placeTried = true;
          if (p) s.place = p;
        }),
      );
    }
  };

  const newSprint = (bubbleText?: string) => {
    const now = Date.now();
    mut((s) => {
      accrue(s, now);
      endAway(s, now);
      s.phase = 'focus';
      s.sprintNo++;
      s.sprintFocus0 = s.focusMs;
      s.phaseStart = now;
      s.phaseEnd = now + s.sprintMin * 60000;
      if (ref.current.deskCheck) s.nextDeskCheck = nextCheckAt();
      if (bubbleText) s.bubble = bubbleText;
    });
    scheduleAll();
  };
  const startBreak = (min = 5, text?: string) => {
    const now = Date.now();
    mut((s) => {
      accrue(s, now);
      endAway(s, now);
      s.phase = 'break';
      s.phaseStart = now;
      s.phaseEnd = now + min * 60000;
      s.bubble = text ?? `Mola zamanı ☕ Kalk, su iç, biraz hareket et. ${min} dakika sonra seni çağıracağım.`;
    });
    scheduleAll();
  };
  const takeBreak = () => {
    sheet.show({
      title: 'Mola ver',
      body: <T muted>Mola vermek de çalışmanın parçası. Ne kadar istersin?</T>,
      buttons: [
        { label: '5 dakika', kind: 'primary', onPress: () => startBreak(5) },
        { label: '10 dakika', onPress: () => startBreak(10) },
        { label: '15 dakika', onPress: () => startBreak(15) },
        { label: 'Yemek: 30 dakika', onPress: () => startBreak(30, 'Afiyet olsun 🍲 30 dakika sonra seni çağıracağım.') },
      ],
    });
  };

  const sprintDone = () => {
    mut((s) => {
      accrue(s);
      s.phase = 'await';
    });
    cancel('desk');
    feedback(true);
    const s = ref.current.session!;
    const len = Math.max(60000, s.phaseEnd - s.phaseStart);
    const got = Math.max(0, s.focusMs - (s.sprintFocus0 ?? 0));
    const gotMin = Math.round(got / 60000);
    const lostMin = Math.max(0, Math.round((len - got) / 60000));
    const good = got / len >= 0.6;
    sheet.show({
      title: good ? `Sprint ${s.sprintNo} bitti 🎉` : `Sprint ${s.sprintNo} bitti`,
      dismissable: false,
      body: good ? (
        <T>
          Bu sprintte {gotMin} dk odaklandın, {left(s).length} adım kaldı. Hiperodaktaysan devam edebilirsin; yorulduysan mola tam zamanı.
        </T>
      ) : (
        <View style={{ gap: 6 }}>
          <T>
            Bu sprintin {gotMin} dakikasında odaktaydın, yaklaşık {lostMin} dakikası başka yerde geçti. Odak süresine sadece çalıştığın dakikalar yazıldı.
          </T>
          <T muted>Sorun değil, olur böyle. Bir sonraki sprint yeni bir başlangıç 🌱</T>
        </View>
      ),
      buttons: [
        { label: '5 dakika mola', kind: 'primary', onPress: () => startBreak(5) },
        { label: 'Devam, odaktayım', onPress: () => newSprint() },
      ],
    });
  };
  const breakDone = () => {
    mut((s) => {
      accrue(s);
      s.phase = 'await';
    });
    feedback(true);
    sheet.show({
      title: 'Mola bitti 🌱',
      dismissable: false,
      body: <BekciSays text={sayNow('breakEnd')} />,
      buttons: [
        { label: 'Hazırım, başlıyorum', kind: 'primary', onPress: () => newSprint(sayNow('back')) },
        { label: '5 dakika daha', onPress: () => startBreak(5) },
      ],
    });
  };

  /* ---- "Orada mısın?" ve yerinde olmama ---- */
  const deskPassed = () => {
    checkDeadline.current = null;
    mut((s) => {
      s.nextDeskCheck = nextCheckAt();
      s.bubble = say(ref.current, 'deskOk');
    });
    feedback();
    scheduleAll();
  };
  const comeBack = () => {
    mut((s, d) => {
      endAway(s);
      s.returns++;
      d.stats.returns++;
      d.drops++;
      s.nextDeskCheck = nextCheckAt();
      s.bubble = 'Geri dönmek de bir beceri 🌱 ' + say(d, 'back');
    });
    feedback();
    water();
    scheduleAll();
  };
  const missedSheet = () => {
    sheet.show({
      title: 'Yerinde yoksun gibi',
      dismissable: false,
      body: (
        <View style={{ gap: 6 }}>
          <BekciSays text={sayNow('deskMiss')} />
          <T small muted>Saat işlemeye devam ediyor ama döndüğünü söyleyene kadar geçen süre odak sayılmıyor.</T>
        </View>
      ),
      buttons: [
        { label: 'Döndüm, devam ediyorum', kind: 'primary', onPress: comeBack },
        {
          label: 'Mola veriyorum',
          onPress: () => {
            mut((s) => endAway(s));
            takeBreak();
          },
        },
      ],
    });
  };
  /** Cevapsız kalan soru: soru sorulduğundan beri geçen süre odak sayılmaz. */
  const markAway = (from?: number) => {
    sheet.close();
    checkDeadline.current = null;
    mut((s, d) => {
      const now = Date.now();
      accrue(s, now);
      if (from && s.phase === 'focus') uncount(s, Math.max(from, s.phaseStart, s.lastResume ?? 0), now);
      s.away = true;
      s.awaySince = now;
      s.kopma++;
      s.nextDeskCheck = null;
      s.bubble = say(d, 'deskMiss');
    });
    feedback(true);
    missedSheet();
  };
  const deskCheck = () => {
    const due = ref.current.session?.nextDeskCheck ?? Date.now();
    // Bildirim görmezden gelinip sonra uygulamaya dönülürse yeni 2 dakika verilmez:
    // süre, yoklamanın zamanı geldiği anda başlamış sayılır.
    if (!checkDeadline.current) checkDeadline.current = due + 120000;
    mut((s) => (s.nextDeskCheck = null));
    if (Date.now() >= checkDeadline.current) {
      markAway(due);
      return;
    }
    feedback(true);
    sheet.show({
      title: 'Orada mısın? 🌱',
      dismissable: false,
      body: (
        <View style={{ gap: 6 }}>
          <T>Sadece "Buradayım"a dokun. 2 dakika içinde cevap gelmezse odadaki arkadaşların seni "yerinde değil" görür.</T>
          <Countdown until={checkDeadline.current} onEnd={() => markAway(due)} />
        </View>
      ),
      buttons: [{ label: 'Buradayım', kind: 'primary', onPress: deskPassed }],
    });
  };

  /* ---- Hareket bekçisi: ≈2 m yürüdün ya da telefonu eline aldın ---- */
  const slipped = () => {
    water();
    mut((x, d) => {
      x.kopma++;
      x.returns++;
      d.stats.returns++;
      d.drops++;
      x.bubble = 'Fark etmen bile bir beceri 🌱 Devam: ' + (cur(x)?.t ?? '') + '.';
    });
  };
  const moveCheck = (kind: MoveKind, steps: number) => {
    const s = ref.current.session;
    if (!s || s.phase !== 'focus' || s.away) return;
    feedback(true);
    const shownAt = Date.now();
    const until = shownAt + 60000;
    const cont = (text: string) => () => mut((x) => (x.bubble = text));
    sheet.show({
      title: kind === 'steps' ? 'Yerinden kalktın' : 'Telefon elinde',
      dismissable: false,
      body: (
        <View style={{ gap: 6 }}>
          <BekciSays text={sayNow(kind === 'steps' ? 'move' : 'pickup')} />
          {kind === 'steps' && (
            <T small muted>
              Yaklaşık {steps} adım (≈ {Math.max(1, Math.round(steps * 0.6))} m) hareket algılandı.
            </T>
          )}
          <T small muted>1 dakika cevap gelmezse, bu andan itibaren geçen süre odak sayılmaz.</T>
          <Countdown until={until} onEnd={() => markAway(shownAt)} />
        </View>
      ),
      buttons:
        kind === 'steps'
          ? [
              { label: 'Yer değiştirdim, devam', kind: 'primary', onPress: cont('Yeni yerinde devam 🌱 Şu an: ' + (cur(s)?.t ?? '') + '.') },
              { label: 'Kısa ihtiyaç (tuvalet, su): 5 dk', onPress: () => startBreak(5, 'Kısa mola 🚰 5 dakika sonra buradayız.') },
              { label: 'Yemek molası: 30 dk', onPress: () => startBreak(30, 'Afiyet olsun 🍲 30 dakika sonra seni çağıracağım.') },
              { label: 'Kaptırdım, dönüyorum', kind: 'soft', onPress: slipped },
            ]
          : [
              { label: 'Rota için baktım, bırakıyorum', kind: 'primary', onPress: cont('Tamam, telefonu bırak. ' + say(ref.current, 'back')) },
              { label: 'Kaptırdım, bırakıyorum', kind: 'soft', onPress: slipped },
              { label: 'Mola veriyorum', onPress: takeBreak },
            ],
    });
  };

  /* ---- Çalışma yeri (GPS): bina / kafe dışına çıkış ---- */
  const placeCheck = (meters: number) => {
    const s = ref.current.session;
    if (!s || s.phase !== 'focus' || s.away) return;
    feedback(true);
    const shownAt = Date.now();
    const until = shownAt + 120000;
    sheet.show({
      title: 'Çalışma yerinden ayrıldın',
      dismissable: false,
      body: (
        <View style={{ gap: 6 }}>
          <BekciSays text={sayNow('place')} />
          <T small muted>Çalışma yerine uzaklığın yaklaşık {meters} m. 2 dakika cevap gelmezse bu süre odak sayılmaz.</T>
          <Countdown until={until} onEnd={() => markAway(shownAt)} />
        </View>
      ),
      buttons: [
        {
          label: 'Yeni yerde çalışıyorum (burayı kaydet)',
          kind: 'primary',
          onPress: () => {
            bubble('Yeni çalışma yerin kaydediliyor 📍 Devam: ' + (cur(ref.current.session)?.t ?? ''));
            capturePlace().then((p) => p && mut((x) => (x.place = p)));
          },
        },
        { label: 'Mola veriyorum', onPress: takeBreak },
        { label: 'Kaptırdım, dönüyorum', kind: 'soft', onPress: slipped },
      ],
    });
  };

  /* ---- Başka uygulamadan dönüş ---- */
  const appReturnSheet = (ms: number) => {
    const m = Math.max(1, Math.round(ms / 60000));
    feedback();
    sheet.show({
      title: 'Tekrar hoş geldin 👋',
      body: (
        <View style={{ gap: 6 }}>
          <BekciSays text={sayNow('away')} />
          <T small muted>Yaklaşık {m} dakika başka bir uygulamadaydın. Saat işlemeye devam etti ama bu süre odak sayılmadı.</T>
        </View>
      ),
      buttons: [
        { label: 'Devam ediyorum', kind: 'primary', onPress: () => bubble(sayNow('back')) },
        { label: 'Kaptırmışım, döndüm', kind: 'soft', onPress: slipped },
      ],
    });
  };

  /* ---- Bitiş ---- */
  const finish = (all: boolean, crumb?: { where: string; next: string }) => {
    const st = ref.current;
    const s = st.session;
    if (!s) return;
    const fm = Math.round(focusMsNow(s) / 60000);
    const am = Math.round(awayMsNow(s) / 60000);
    const doneCount = s.topics.filter((t) => t.done).length;
    const remaining = left(s).map((t) => t.t);
    const parked = st.park.filter((p) => p.at >= s.start && !p.done);
    const planted = fm >= 4 || all;
    set((d) => {
      d.stats.focusMin += fm;
      d.stats.sessions++;
      d.stats.longestMin = Math.max(d.stats.longestMin, fm);
      if (planted) d.garden.unshift({ id: uid(), species: s.species ?? 0, stage: all ? 4 : stageFor(fm), min: fm, at: Date.now() });
      d.crumb = all ? null : { where: crumb?.where ?? '', next: crumb?.next ?? '', contract: s.contract, topicsLeft: remaining, at: Date.now() };
      d.session = null;
      d.noise = false;
      d.myState = all ? 'done' : 'idle';
    });
    cancelSession();
    room.logFocus(fm, doneCount);
    if (all) confetti();
    sheet.show({
      title: all ? 'Bitti! 🎉' : 'Oturum kaydedildi',
      body: (
        <View style={{ gap: 8 }}>
          {planted && (
            <View style={{ alignItems: 'center', backgroundColor: C.mintSoft, borderRadius: 18, padding: 10 }}>
              <Plant stage={all ? 4 : stageFor(fm)} species={s.species ?? 0} size={100} />
              <T small style={{ textAlign: 'center', color: '#166A4C' }}>
                {SPECIES[(s.species ?? 0) % SPECIES.length].name} bahçene dikildi.{all ? ' Tüm adımları bitirdiğin için açtı! 🌼' : ''}
              </T>
            </View>
          )}
          <T>
            {all
              ? `Tüm adımları bitirdin. ${fm} dk odak, ${s.returns} geri dönüş. Bu bir zafer.${am ? ` (${am} dk uzakta geçti, odağa sayılmadı.)` : ''}`
              : `${fm} dk odaklandın${am ? `, ${am} dk uzakta geçti` : ''}. Kaldığın yer kaydedildi, döndüğünde "Neredeydim?" kartında seni bekliyor.`}
          </T>
          {parked.length > 0 && (
            <View style={{ gap: 4 }}>
              <T bold>Oturum sırasında park ettiklerin:</T>
              {parked.map((p) => (
                <T key={p.id}>• {p.text}</T>
              ))}
              <T small muted>
                Şimdi sırası gelebilir. Park sekmesinde duruyorlar.
              </T>
            </View>
          )}
        </View>
      ),
      buttons: [{ label: 'Tamam', kind: 'primary' }],
    });
  };

  const crumbSheet = () => {
    const vals: Record<string, string> = { where: cur(ref.current.session)?.t ?? '', next: '' };
    sheet.show({
      title: 'Kaldığın yeri kaydet',
      body: (
        <View style={{ gap: 8 }}>
          <T small muted>
            Geri döndüğünde ilk bunu göreceksin. 10 saniye sürer.
          </T>
          <FormBody
            vals={vals}
            fields={[
              { key: 'where', label: 'Nerede kaldın?', initial: vals.where },
              { key: 'next', label: 'Sıradaki adım ne?', placeholder: 'Örn: 7. soruyu çöz' },
            ]}
          />
        </View>
      ),
      buttons: [
        { label: 'Kaydet ve bitir', kind: 'primary', onPress: () => finish(false, { where: vals.where.trim(), next: vals.next.trim() }) },
        { label: 'Vazgeçtim, devam', onPress: () => bubble(sayNow('back')) },
      ],
    });
  };

  const quit = () => {
    const s = ref.current.session;
    if (!s) return;
    sheet.show({
      title: 'Bitirmek mi istiyorsun?',
      body: (
        <View style={{ gap: 8 }}>
          <BekciSays text={sayNow('quit')} />
        </View>
      ),
      buttons: [
        {
          label: 'Biraz daha devam',
          kind: 'primary',
          onPress: () =>
            mut((x, d) => {
              x.returns++;
              d.stats.returns++;
              d.drops++;
              x.bubble = say(d, 'back');
            }),
        },
        { label: 'Mola ver', onPress: takeBreak },
        { label: 'Bugünlük bu kadar', kind: 'soft', onPress: crumbSheet },
      ],
    });
  };

  const topicDone = () => {
    const s = ref.current.session;
    if (!s || !cur(s)) return;
    set((d) => {
      const t = cur(d.session);
      if (t) t.done = true;
      d.stats.done++;
    });
    if (!cur(ref.current.session)) {
      feedback(true);
      finish(true);
      return;
    }
    feedback();
    confetti();
    bubble(sayNow('done1'));
  };

  const park = () => {
    const vals = { text: '', kind: 'is' as 'is' | 'fikir' };
    sheet.show({
      title: 'Park et, işine dön',
      body: <ParkBody vals={vals} />,
      buttons: [
        {
          label: 'Park et',
          kind: 'primary',
          onPress: () => {
            const t = vals.text.trim();
            if (!t) return;
            set((d) => {
              d.park.unshift({ id: uid(), text: t, kind: vals.kind, at: Date.now(), done: false });
            });
            toast('Park edildi. Oturum bitince hatırlatacağım.');
            if (ref.current.session) bubble('Kaydettim, kaybolmaz. Şimdi geri dön: ' + (cur(ref.current.session)?.t ?? '') + '.');
          },
        },
        { label: 'Vazgeç' },
      ],
    });
  };

  const toggleNoise = () => set((d) => (d.noise = !d.noise));

  const joinGroup = (endsAt: number) => {
    if (!ref.current.session) {
      toast('Önce Çalış sekmesinde oturum başlat, sonra ortak sprinte katıl.');
      setTab('calis');
      return;
    }
    const now = Date.now();
    mut((s) => {
      accrue(s, now);
      endAway(s, now);
      s.phase = 'focus';
      s.sprintFocus0 = s.focusMs;
      s.phaseStart = now;
      s.phaseEnd = endsAt;
      s.bubble = 'Ortak sprinte katıldın 🤝 Herkes ' + hm(new Date(endsAt)) + '\'e kadar çalışıyor.';
    });
    sheet.close();
    scheduleAll();
    setTab('calis');
  };

  /* ---- Zaman Çapası ---- */
  const anchorTick = () => {
    const a = ref.current.anchor;
    if (!a) return;
    const info = anchorInfo(a);
    const key = a.setAt + ':' + a.prep;
    if (info.min <= 0 && anchorFired.current !== key && !sheet.isOpen()) {
      anchorFired.current = key;
      feedback(true);
      sheet.show({
        title: 'Kalkma zamanı! ⏰',
        dismissable: false,
        body: <T>{(a.label || 'Planın') + ' için şimdi çıkman gerekiyor. Hiperodak bekleyebilir, kaldığın yeri kaydedelim.'}</T>,
        buttons: ref.current.session
          ? [
              { label: 'Kaldığım yeri kaydet ve çık', kind: 'primary', onPress: crumbSheet },
              {
                label: '5 dakika daha',
                onPress: () =>
                  set((d) => {
                    if (d.anchor) d.anchor.prep -= 5;
                  }),
              },
            ]
          : [{ label: 'Tamam, çıkıyorum', kind: 'primary' }],
      });
    }
  };

  /* ---- Zamanlayıcıdan en güncel fonksiyonlara erişim ---- */
  const fns = useRef({ sprintDone, breakDone, deskCheck, anchorTick, joinGroup, scheduleAll, moveCheck, placeCheck, appReturnSheet });
  fns.current = { sprintDone, breakDone, deskCheck, anchorTick, joinGroup, scheduleAll, moveCheck, placeCheck, appReturnSheet };
  room.onGroupJoin.current = (e: number) => fns.current.joinGroup(e);

  /* Motor: her saniye */
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n++;
      if (AppState.currentState !== 'active') return;
      if (n % 15 === 1) fns.current.anchorTick();
      const st = ref.current;
      const s = st.session;
      if (!s || sheet.isOpen()) return;
      const now = Date.now();
      if (s.phase === 'focus' && now >= s.phaseEnd) fns.current.sprintDone();
      else if (s.phase === 'break' && now >= s.phaseEnd) fns.current.breakDone();
      else if (s.phase === 'focus' && !s.away && st.deskCheck && s.nextDeskCheck && now >= s.nextDeskCheck) fns.current.deskCheck();
    }, 1000);
    return () => clearInterval(id);
  }, [ref, sheet]);

  /* Arka plan: ekran kapandıysa sorun yok; başka uygulamaya geçildiyse nazikçe hatırlat */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const s = ref.current.session;
      if (next === 'background') {
        if (!s || s.phase !== 'focus' || s.hiddenAt) return;
        const hiddenAt = Date.now();
        set((d) => {
          if (d.session) d.session.hiddenAt = hiddenAt;
        });
        setTimeout(() => {
          const kind = classifyLeave(hiddenAt);
          if (kind === 'app') {
            // Rota'dan çıkıldığı andan itibaren odak sayılmaz
            mut((x) => {
              if (x.elsewhere || x.phase !== 'focus') return;
              accrue(x, hiddenAt);
              x.elsewhere = true;
              x.elsewhereSince = hiddenAt;
            });
            schedule('away', Date.now() + 60000, 'Bekçi 🌱', say(ref.current, 'ping'));
          } else if (kind === 'unknown') {
            // Expo Go: ekran mı kapandı, başka uygulama mı bilinemez; nazik ve geç bir hatırlatma
            schedule('away', Date.now() + 5 * 60000, 'Rota açık 🌱', 'Bitkin büyümeye devam ediyor. Ekranı kapatıp çalışıyorsan her şey yolunda.');
          }
        }, 1500);
      } else if (next === 'active') {
        cancel('away');
        if (s && s.hiddenAt) {
          const hiddenAt = s.hiddenAt;
          const ms = Date.now() - hiddenAt;
          const kind = classifyLeave(hiddenAt);
          set((d) => {
            const x = d.session;
            if (!x) return;
            const now = Date.now();
            if (kind === 'app') {
              if (!x.elsewhere && x.phase === 'focus') {
                // Arka plandayken sınıflandırma çalışamadıysa şimdi düzelt
                accrue(x, hiddenAt);
                x.elsewhere = true;
                x.elsewhereSince = hiddenAt;
              }
              if (x.elsewhere) {
                x.awayMs = (x.awayMs ?? 0) + Math.max(0, now - (x.elsewhereSince ?? hiddenAt));
                x.elsewhere = false;
                x.elsewhereSince = null;
                x.lastResume = now;
                x.lastTick = now;
              }
            }
            x.hiddenAt = null;
          });
          if (kind === 'app' && ms > 30000 && !s.away) fns.current.appReturnSheet(ms);
        }
      }
    });
    return () => sub.remove();
  }, [ref, set]);

  /* Hareket ve çalışma yeri bekçileri */
  const guarding = !!S.session && S.session.phase === 'focus' && !S.session.away;
  const blocked = () => sheet.isOpen() || AppState.currentState !== 'active';
  useMotionGuard({
    enabled: guarding && S.motion,
    steps: true,
    pickup: S.pickup,
    stepThreshold: S.stepThr,
    blocked,
    onMove: (k, n) => fns.current.moveCheck(k, n),
  });
  usePlaceGuard({
    enabled: guarding && S.placeOn,
    place: S.session?.place ?? null,
    blocked,
    onLeave: (m) => fns.current.placeCheck(m),
  });

  /* Ekran açık kalsın + kahverengi gürültü */
  const active = !!S.session;
  useEffect(() => {
    if (active) activateKeepAwakeAsync('rota').catch(() => {});
    else deactivateKeepAwake('rota').catch(() => {});
  }, [active]);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);
  useEffect(() => {
    try {
      if (S.noise && active) {
        noise.loop = true;
        noise.volume = 0.6;
        noise.play();
      } else noise.pause();
    } catch {}
  }, [S.noise, active, noise]);

  /* Uygulama yeniden açıldığında yarım kalan oturumun bildirimlerini kur */
  useEffect(() => {
    if (ref.current.session) fns.current.scheduleAll();
  }, [ref]);

  return <SessionCtx.Provider value={{ startSession, topicDone, quit, takeBreak, park, toggleNoise }}>{children}</SessionCtx.Provider>;
}

export const preciseLeave = precise;

export function anchorInfo(a: { time: string; prep: number; setAt: number }) {
  const [h, m] = a.time.split(':').map(Number);
  const t = new Date();
  t.setHours(h, m, 0, 0);
  if (t.getTime() < a.setAt - 60000) t.setDate(t.getDate() + 1);
  const leave = new Date(t.getTime() - (a.prep || 0) * 60000);
  return { target: t, leave, min: Math.round((leave.getTime() - Date.now()) / 60000) };
}
