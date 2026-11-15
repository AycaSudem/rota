import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { GrowingPlant, nextStageIn, SPECIES, STAGE_NAMES, stageFor } from '../garden';
import { useSession } from '../session';
import { ago, awayMsNow, cur, focusMsNow, hm, left, pad, say, useStore } from '../store';
import { C, FONT } from '../theme';
import { Btn, Card, H, Input, Kicker, Lantern, s, Seg, T, TINT } from '../ui';

function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

function Home() {
  const { S, set } = useStore();
  const act = useSession();
  const [topic, setTopic] = useState('');
  const add = () => {
    const t = topic.trim();
    if (!t) return;
    set((d) => {
      d.draft.topics.push(t);
    });
    setTopic('');
  };
  const resume = () => {
    const c = S.crumb;
    if (!c) return;
    const list: string[] = [];
    if (c.next) list.push(c.next);
    c.topicsLeft.forEach((t) => !list.includes(t) && list.push(t));
    set((d) => {
      d.draft.contract = c.contract;
      d.draft.topics = list;
    });
    act.startSession();
  };
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <H size={26}>
          {hello}, {S.name} 👋
        </H>
        <T muted>Bugün neyi bitirmek istiyorsun?</T>
      </View>

      {S.crumb && (
        <Card tint={TINT.sky}>
          <Kicker color={C.sky}>Neredeydim?</Kicker>
          <H size={18}>
            {ago(S.crumb.at)}: {S.crumb.where || S.crumb.contract || 'bir oturum'}
          </H>
          {!!S.crumb.next && (
            <T>
              Sıradaki adım: <T bold>{S.crumb.next}</T>
            </T>
          )}
          <Btn label="Kaldığım yerden başla" kind="primary" onPress={resume} />
        </Card>
      )}

      <Card>
        <T bold>Ne çalışacaksın?</T>
        <Input
          multiline
          value={S.draft.contract}
          onChangeText={(v) => set((d) => (d.draft.contract = v))}
          placeholder="Örn: Tarih vizesi, 3. ünite"
        />
        <T bold>
          Küçük adımlar <T small muted>(isteğe bağlı)</T>
        </T>
        {S.draft.topics.length > 0 && (
          <View style={{ gap: 8 }}>
            {S.draft.topics.map((t, i) => (
              <View key={i + t} style={s.item}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.accentDeep, fontFamily: FONT[800], fontSize: 13 }}>{i + 1}</Text>
                </View>
                <T style={{ flex: 1 }}>{t}</T>
                <Pressable
                  accessibilityLabel="Sil"
                  hitSlop={10}
                  onPress={() =>
                    set((d) => {
                      d.draft.topics.splice(i, 1);
                    })
                  }
                >
                  <Text style={{ color: C.muted, fontSize: 22 }}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={s.row}>
          <Input style={{ flex: 1 }} value={topic} onChangeText={setTopic} onSubmitEditing={add} placeholder="Örn: Kitabı aç, ilk sayfayı oku" returnKeyType="done" />
          <Btn label="Ekle" kind="soft" onPress={add} />
        </View>
        <T small muted>
          Adım yazmazsan, yukarıya yazdığın tek bir iş olarak başlar.
        </T>
        <T bold>Sprint süresi</T>
        <Seg
          value={S.sprint}
          options={[
            [15, '15 dk'],
            [25, '25 dk'],
            [45, '45 dk'],
          ]}
          onChange={(v) => set((d) => (d.sprint = v))}
        />
        <Btn
          big
          kind="primary"
          label="Başla 🌱"
          onPress={() => {
            if (topic.trim()) add();
            act.startSession();
          }}
        />
      </Card>
    </View>
  );
}

function Running() {
  const { S } = useStore();
  const act = useSession();
  const now = useNow();
  const ses = S.session!;
  const total = Math.max(1, ses.phaseEnd - ses.phaseStart);
  const rem = ses.phase === 'await' ? 0 : Math.max(0, ses.phaseEnd - now);
  const c = cur(ses);
  const l = left(ses);
  const isBreak = ses.phase === 'break';
  const fmin = focusMsNow(ses, now) / 60000;
  const stage = stageFor(fmin);
  const sp = SPECIES[(ses.species ?? 0) % SPECIES.length];
  const timerBg = isBreak ? C.mint : C.accent;
  const web = Platform.OS === 'web';
  const guards = [!web && S.motion && `${S.stepThr} adımda sorar`, !web && S.pickup && 'telefonu alınca sorar', S.placeOn && (ses.place ? `çalışma yeri kayıtlı (±${ses.place.acc} m)` : ses.placeTried ? 'konum izni yok' : 'çalışma yeri alınıyor…')].filter(Boolean);

  return (
    <View style={{ gap: 14 }}>
      {!!ses.contract && (
        <View style={{ paddingHorizontal: 4 }}>
          <Kicker>Bugünkü işin</Kicker>
          <H size={20}>{ses.contract}</H>
        </View>
      )}

      {/* Kronometre */}
      <View style={[s.card, s.lift, { backgroundColor: timerBg, borderColor: timerBg }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', opacity: 0.9, fontFamily: FONT[700] }}>{isBreak ? '☕ Mola' : `Sprint ${ses.sprintNo}`}</Text>
          <Text style={{ color: '#fff', opacity: 0.9, fontFamily: FONT[600] }}>{ses.phase === 'await' ? '' : 'bitiş ' + hm(new Date(ses.phaseEnd))}</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 76, fontFamily: FONT[800], letterSpacing: -1, fontVariant: ['tabular-nums'], textAlign: 'center' }}>
          {pad(Math.floor(rem / 60000))}:{pad(Math.floor((rem % 60000) / 1000))}
        </Text>
        <View style={{ height: 12, backgroundColor: 'rgba(255,255,255,.28)', borderRadius: 999, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${(rem / total) * 100}%`, backgroundColor: '#fff', borderRadius: 999 }} />
        </View>
        <Text style={{ color: '#fff', opacity: 0.85, fontFamily: FONT[500], fontSize: 13, textAlign: 'center' }}>
          {ses.away ? 'Yerinde değilsin · saat işliyor ama bu süre odak sayılmıyor' : guards.length ? 'Bekçi: ' + guards.join(' · ') : 'Bekçi takibi kapalı'}
        </Text>
      </View>

      {/* Bekçi */}
      <View style={{ flexDirection: 'row', gap: 12, backgroundColor: C.sunSoft, borderColor: '#FFDF94', borderWidth: 1.5, borderRadius: 22, padding: 14 }}>
        <Lantern size={30} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.sunDeep, fontFamily: FONT[800], fontSize: 12, letterSpacing: 1 }}>BEKÇİ</Text>
          <T style={{ marginTop: 2 }}>{ses.bubble || say(S, 'back')}</T>
        </View>
      </View>

      {/* Şu anki adım */}
      <Card tint={TINT.coral}>
        <Kicker color={C.coral}>Şu an</Kicker>
        <H size={23}>{c?.t ?? ''}</H>
        <Btn kind="ok" label="Bu bitti ✓" onPress={act.topicDone} />
        <T small muted>
          {l.length > 1 ? 'Sonra: ' + l.slice(1, 4).map((t) => t.t).join(' → ') + (l.length > 4 ? ` (+${l.length - 4})` : '') : 'Bu son adım! 🏁'}
        </T>
      </Card>

      {/* Bitki */}
      <Card tint={TINT.mint} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
        <GrowingPlant stage={stage} species={ses.species ?? 0} size={66} />
        <View style={{ flex: 1, gap: 2 }}>
          <Kicker color={C.mint}>Bitkin</Kicker>
          <T bold>
            {sp.name} · {STAGE_NAMES[stage]}
          </T>
          <T small style={{ color: '#2C6B52' }}>
            {stage < 4 ? `${nextStageIn(fmin)} dk sonra ${STAGE_NAMES[stage + 1].toLocaleLowerCase('tr')} olacak.` : 'Açtı! 🌼 Oturum bitince bahçene dikilecek.'}
          </T>
        </View>
      </Card>

      <View style={s.row}>
        <Btn style={{ flex: 1 }} kind="sun" label="☕ Mola ver" onPress={act.takeBreak} />
        <Btn style={{ flex: 1 }} kind="soft" label="💭 Aklıma geldi" onPress={act.park} />
      </View>
      <Btn kind={S.noise ? 'primary' : 'default'} label={S.noise ? '🔊 Kahverengi gürültü açık' : '🔈 Kahverengi gürültü'} onPress={act.toggleNoise} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 }}>
        {[
          [`${Math.round(fmin)} dk`, 'odak'],
          [`${Math.round(awayMsNow(ses, now) / 60000)} dk`, 'uzakta'],
          [String(ses.kopma), 'kopma'],
          [String(ses.returns), 'geri dönüş'],
        ].map(([v, lbl]) => (
          <View key={lbl} style={{ alignItems: 'center' }}>
            <Text style={{ color: C.ink, fontFamily: FONT[800], fontSize: 20, fontVariant: ['tabular-nums'] }}>{v}</Text>
            <T small muted>
              {lbl}
            </T>
          </View>
        ))}
      </View>
      <Btn kind="ghost" label="Bugünlük bitir" onPress={act.quit} />
    </View>
  );
}

export default function Study() {
  const { S } = useStore();
  return S.session ? <Running /> : <Home />;
}
