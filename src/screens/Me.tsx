import React, { useState } from 'react';
import { Platform, Pressable, Switch, Text, View } from 'react-native';
import { fill, STRENGTHS, TONES, Tone } from '../bekci';
import { Butterfly, Plant, SPECIES } from '../garden';
import { cancel, initNotifications, schedule } from '../notify';
import { anchorInfo, preciseLeave } from '../session';
import { defaults, hm, useStore } from '../store';
import { C, FONT } from '../theme';
import { Btn, Card, H, Input, Kicker, s, Seg, T, TINT, useSheet, useToast } from '../ui';

function Toggle({ title, note, value, onChange }: { title: string; note?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', gap: 12 }]}>
      <View style={{ flex: 1 }}>
        <T bold>{title}</T>
        {note && (
          <T small muted>
            {note}
          </T>
        )}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" />
    </View>
  );
}

export default function Me() {
  const { S, set } = useStore();
  const toast = useToast();
  const sheet = useSheet();
  const [anTime, setAnTime] = useState(S.anchor?.time ?? '');
  const [anPrep, setAnPrep] = useState(String(S.anchor?.prep ?? 40));
  const [anLabel, setAnLabel] = useState(S.anchor?.label ?? '');
  const st = S.stats;
  const butterflies = Math.floor(S.drops / 5);
  const BCOL = ['#F5A524', '#3B9EF0', '#FF7363', '#7B61FF'];

  const saveAnchor = () => {
    const m = anTime.trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
    if (!m) {
      toast('Saati 14:30 biçiminde yaz.');
      return;
    }
    const a = { time: `${m[1].padStart(2, '0')}:${m[2]}`, prep: Math.max(0, Math.min(600, parseInt(anPrep, 10) || 0)), label: anLabel.trim(), setAt: Date.now() };
    set((d) => (d.anchor = a));
    const info = anchorInfo(a);
    initNotifications();
    const what = a.label ? a.label + ' için' : 'Planın için';
    schedule('anchor30', info.leave.getTime() - 30 * 60000, 'Zaman Çapası: 30 dakika ⏰', `${what} ${hm(info.leave)}'de kalkman gerekiyor.`);
    schedule('anchor0', info.leave.getTime(), 'Kalkma zamanı! ⏰', `${what} şimdi çıkman gerekiyor. Hiperodak bekleyebilir.`);
    toast(`Çapa kuruldu. ${hm(info.leave)}'de kalkman gerekiyor.`);
  };

  const tiles: [string | number, string, string][] = [
    [st.focusMin >= 60 ? `${Math.floor(st.focusMin / 60)}s ${st.focusMin % 60}d` : `${st.focusMin} dk`, 'Toplam odak', C.accentSoft],
    [st.sessions, 'Oturum', C.skySoft],
    [st.returns, 'Geri dönüş', C.mintSoft],
    [`${st.longestMin} dk`, 'En uzun oturum', C.sunSoft],
    [st.done, 'Biten adım', C.coralSoft],
    [S.park.filter((p) => p.kind === 'fikir').length, 'Fikir', C.accentSoft],
  ];

  return (
    <View style={{ gap: 14 }}>
      <Card tint={TINT.mint}>
        <H>Bahçen 🌿</H>
        <T small style={{ color: '#2C6B52' }}>
          Biten her oturum bahçene bir bitki diker. Bitkiler asla solmaz; ara verdiğin günler bahçeden hiçbir şey eksiltmez.
        </T>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 10, minHeight: 120 }}>
          {butterflies > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
              {Array.from({ length: Math.min(butterflies, 12) }).map((_, i) => (
                <View key={i} style={{ marginTop: (i % 3) * 6 }}>
                  <Butterfly color={BCOL[i % BCOL.length]} />
                </View>
              ))}
            </View>
          )}
          {S.garden.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
              <Plant stage={0} size={56} />
              <T small muted style={{ textAlign: 'center' }}>
                İlk oturumunla ilk tohumunu ekeceksin.
              </T>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {S.garden.slice(0, 60).map((p) => (
                <View key={p.id} style={{ width: '20%', alignItems: 'center' }}>
                  <Plant stage={p.stage} species={p.species} size={52} />
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            [`🌱 ${S.garden.length}`, 'bitki'],
            [`🌼 ${S.garden.filter((p) => p.stage >= 4).length}`, 'çiçek'],
            [`💧 ${S.drops}`, 'damla'],
            [`🦋 ${butterflies}`, 'kelebek'],
          ].map(([v, l]) => (
            <View key={l} style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', gap: 4 }}>
              <Text style={{ fontFamily: FONT[700], color: C.ink }}>{v}</Text>
              <Text style={{ fontFamily: FONT[400], color: C.muted }}>{l}</Text>
            </View>
          ))}
        </View>
        <T small style={{ color: '#2C6B52' }}>
          Su damlaları geri dönüşlerden gelir. Her 5 damla bahçene bir kelebek getirir.
          {S.garden.length > 0 ? ` Türler: ${Array.from(new Set(S.garden.map((p) => SPECIES[p.species % SPECIES.length].name))).join(', ')}.` : ''}
        </T>
      </Card>

      <Card tint={TINT.violet}>
        <H>Bekçi seni nasıl takip etsin?</H>
        <T small muted>
          Yer değiştirmek serbest, sadece söylemen yeterli. Kronometre hiçbir durumda durmaz.
        </T>
        {Platform.OS === 'web' && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 4 }}>
            <T bold small>
              🌐 Web sürümünü kullanıyorsun
            </T>
            <T small muted>
              Web sürümünde adım sayarı, "telefon elinde" algılama, uygulama kapalıyken gelen bildirimler ve ekran/uygulama ayrımı çalışmaz. Çalışma yeri (konum), "Orada mısın?" yoklaması, odalar ve bahçe çalışır.
            </T>
          </View>
        )}
        <Toggle title="Kalkınca sor" note="Telefonla birkaç adım atarsan (tuvalet, yatak, mutfak) sorar." value={S.motion} onChange={(v) => set((d) => (d.motion = v))} />
        {S.motion && (
          <Seg
            value={S.stepThr}
            options={[
              [3, '3 adım ≈ 2 m'],
              [4, '4 ≈ 2,5 m'],
              [8, '8 ≈ 5 m'],
            ]}
            onChange={(v) => set((d) => (d.stepThr = v))}
          />
        )}
        <Toggle title="Telefonu eline alınca sor" note="Rota'yı kullanırken sormaz." value={S.pickup} onChange={(v) => set((d) => (d.pickup = v))} />
        <Toggle
          title="Çalışma yeri (konum)"
          note="Oturum başında konumun çalışma yerin olarak kaydedilir. Kafeden ya da evden çıkarsan sorar. GPS bina içinde 5-20 m şaştığı için ev içi hareketleri adım sayarı yakalar."
          value={S.placeOn}
          onChange={(v) => set((d) => (d.placeOn = v))}
        />
        <Toggle
          title={'"Orada mısın?" yoklaması'}
          note="Telefonu masada bırakıp kalkarsan adım sayılmaz; 20-30 dakikada bir tek dokunuşla yoklama yapılır."
          value={S.deskCheck}
          onChange={(v) => set((d) => (d.deskCheck = v))}
        />
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 4 }}>
          <T bold small>
            📵 Ekranı kapatmak sorun değil
          </T>
          <T small muted>
            {Platform.OS === 'web'
              ? 'Web sürümünde ekranın kapandığı ile başka uygulamaya geçildiği ayırt edilemiyor; Bekçi bu konuda sessiz kalır.'
              : preciseLeave
              ? 'Ekranı kapatırsan Bekçi hiçbir şey sormaz. Başka bir uygulamaya geçersen 1 dakika sonra nazikçe hatırlatır ve odadakiler seni "başka uygulamada" görür.'
              : 'Expo Go ile çalışırken telefon, ekranın kapandığını ve başka uygulamaya geçildiğini ayırt edemiyor. Bu yüzden Bekçi şimdilik ikisinde de sessiz kalıyor, sadece 5 dakika sonra nazik bir hatırlatma gönderiyor. Kalıcı kurulumda (KURULUM.md, 5. adım) bu ayrım tam çalışır.'}
          </T>
        </View>
      </Card>

      <Card tint={TINT.sun}>
        <H>Bekçinin tonu</H>
        {(Object.keys(TONES) as Tone[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => set((d) => (d.tone = k))}
            accessibilityRole="button"
            accessibilityState={{ selected: S.tone === k }}
            style={{
              borderWidth: 2,
              borderColor: S.tone === k ? C.sun : 'transparent',
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 12,
              gap: 3,
            }}
          >
            <T bold style={{ fontSize: 17 }}>
              {S.tone === k ? '● ' : ''}
              {TONES[k].name}
            </T>
            <T small muted>
              {TONES[k].desc}
            </T>
          </Pressable>
        ))}
      </Card>

      <Card>
        <H>Güç Haritası</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tiles.map(([v, l, bg]) => (
            <View key={l} style={{ width: '31.5%', backgroundColor: bg, borderRadius: 16, padding: 10 }}>
              <Text style={{ color: C.ink, fontSize: 21, fontFamily: FONT[800], fontVariant: ['tabular-nums'] }}>{v}</Text>
              <T small muted>
                {l}
              </T>
            </View>
          ))}
        </View>
        <T small muted>
          Seri (streak) yok. Burada başarısızlık sayılmaz, geri dönüşler sayılır.
        </T>
        <T bold>Sende hangileri var?</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {STRENGTHS.map(([n]) => {
            const on = S.strengths.includes(n);
            return (
              <Pressable
                key={n}
                onPress={() => set((d) => (d.strengths = on ? d.strengths.filter((x) => x !== n) : [...d.strengths, n]))}
                style={{ borderWidth: 1.5, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accent : C.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Text style={{ color: on ? C.onAccent : C.ink, fontFamily: FONT[700] }}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
        {STRENGTHS.filter(([n]) => S.strengths.includes(n)).map(([n, tip]) => (
          <View key={n} style={{ borderLeftWidth: 4, borderLeftColor: C.accent, backgroundColor: C.accentSoft, padding: 10, borderRadius: 10 }}>
            <T small>
              <T small bold>
                {n}:{' '}
              </T>
              {fill(tip, { returns: st.returns })}
            </T>
          </View>
        ))}
      </Card>

      <Card tint={TINT.sky}>
        <H>Zaman Çapası ⏰</H>
        <T small muted>
          Hiperodaktayken geç kalmamak için. Saati ve hazırlık + yol süresini yaz; 30 dakika kala ve kalkma anında telefonun çalar, uygulama kapalı olsa bile.
        </T>
        <Input value={anLabel} onChangeText={setAnLabel} placeholder="Nereye? Örn: Ders, randevu" />
        <View style={s.row}>
          <Input style={{ flex: 1 }} value={anTime} onChangeText={setAnTime} placeholder="Saat (14:30)" keyboardType="numbers-and-punctuation" />
          <Input style={{ flex: 1 }} value={anPrep} onChangeText={setAnPrep} placeholder="Hazırlık+yol dk" keyboardType="number-pad" />
        </View>
        <View style={s.row}>
          <Btn style={{ flex: 1 }} kind="primary" label="Çapayı kur" onPress={saveAnchor} />
          {S.anchor && (
            <Btn
              label="Kaldır"
              onPress={() => {
                set((d) => (d.anchor = null));
                cancel('anchor30');
                cancel('anchor0');
              }}
            />
          )}
        </View>
      </Card>

      <Card>
        <Kicker>Profil</Kicker>
        <T small bold>
          Odada görünen adın
        </T>
        <Input value={S.name} onChangeText={(v) => set((d) => (d.name = v.slice(0, 30)))} placeholder="Adın" />
        <Btn
          kind="danger"
          label="Her şeyi sıfırla"
          onPress={() =>
            sheet.show({
              title: 'Her şeyi sıfırla?',
              body: <T>Oturumlar, park listesi, bahçe, istatistikler ve ayarlar silinecek. Bu geri alınamaz.</T>,
              buttons: [
                {
                  label: 'Evet, sıfırla',
                  kind: 'danger',
                  onPress: () =>
                    set((d) => {
                      const n = d.name;
                      Object.assign(d, defaults());
                      d.name = n;
                    }),
                },
                { label: 'Vazgeç' },
              ],
            })
          }
        />
      </Card>
    </View>
  );
}
