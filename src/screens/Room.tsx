import React, { useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';
import { MemberState, Meta, useRoom } from '../room';
import { ago, hm, useStore } from '../store';
import { C, FONT } from '../theme';
import { Btn, Card, H, Input, Kicker, Pill, s, Seg, T, TINT, useSheet, useToast } from '../ui';

const LBL: Record<MemberState, [string, string]> = {
  working: ['Çalışıyor', C.ok],
  break: ['Molada', C.accent],
  away: ['Yerinde değil', C.coral],
  phone: ['Başka uygulamada', C.danger],
  idle: ['Çalışmıyor', C.muted],
  done: ['Bitirdi', C.ok],
};

function useNow(ms: number) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

function MemberRow({ m, me, now }: { m: Meta; me: boolean; now: number }) {
  const room = useRoom();
  const sheet = useSheet();
  const [label, color] = LBL[m.state] ?? LBL.idle;
  const offline = m.online === false;
  const PAST: Record<MemberState, string> = {
    working: 'çalışıyordu',
    break: 'moladaydı',
    away: 'yerinde değildi',
    phone: 'başka uygulamadaydı',
    idle: 'çalışmıyordu',
    done: 'bitirmişti',
  };
  const remain = m.phaseEnd > now ? Math.ceil((m.phaseEnd - now) / 60000) : 0;
  const pokeSheet = () => {
    const opts = ["Neden online'sın? Çalışsana!", `Daha ${m.left || 'birkaç'} adımın var, emin misin?`, 'Kapat şu telefonu, masaya dön 😤', 'Hadi, son bir sprint!'];
    let custom = '';
    sheet.show({
      title: m.name + ' adlı arkadaşını dürt',
      body: (
        <View style={{ gap: 8 }}>
          {opts.map((o) => (
            <Btn
              key={o}
              label={o}
              onPress={() => {
                sheet.close();
                room.poke(m.uid, 'poke', o);
              }}
            />
          ))}
          <Input placeholder="Ya da kendi mesajını yaz" onChangeText={(v) => (custom = v)} />
        </View>
      ),
      buttons: [{ label: 'Kendi mesajımı gönder', kind: 'primary', onPress: () => custom.trim() && room.poke(m.uid, 'poke', custom.trim()) }, { label: 'Vazgeç' }],
    });
  };
  return (
    <View style={{ backgroundColor: C.surface2, borderColor: me ? C.accent : C.line, borderWidth: 1, borderRadius: 12, padding: 12, gap: 6, opacity: offline ? 0.75 : 1 }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T bold style={{ fontSize: 17 }}>
          {m.name}
          {me ? ' (sen)' : ''}
        </T>
        <Pill label={offline ? 'Çevrimdışı' : label} color={offline ? C.muted : color} />
      </View>
      {offline && (
        <T small muted>
          Son görülme {ago(m.seenAt ?? 0)} · {PAST[m.state] ?? ''}
          {m.state === 'working' && m.topic ? ` (${m.topic})` : ''}
        </T>
      )}
      {!offline && (m.state === 'working' || m.state === 'break' || m.state === 'away' || m.state === 'phone') && (
        <T small muted>
          {m.left}/{m.total} adım kaldı{m.topic ? ' · şu an: ' + m.topic : ''}
          {remain ? ` · ${remain} dk` : ''}
          {m.place ? ' · 📍' : ''}
        </T>
      )}
      {!me && !offline && (
        <View style={s.row}>
          <Btn small kind="primary" label="Dürt" onPress={pokeSheet} />
          <Btn small label="Alkışla 👏" onPress={() => room.poke(m.uid, 'cheer', 'Alkışlıyorum, devam! 👏')} />
        </View>
      )}
    </View>
  );
}

export default function Room() {
  const room = useRoom();
  const { S } = useStore();
  const toast = useToast();
  const now = useNow(5000);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [groupMin, setGroupMin] = useState(25);

  if (!room.configured) {
    return (
      <Card tint={TINT.violet}>
        <H>Çalışma odaları</H>
        <T>Ortak odalar için uygulamanın bir sunucuya bağlanması gerekiyor. Kurulum rehberindeki "Supabase" adımını tamamlayıp src/config.ts dosyasına proje bilgilerini yaz.</T>
        <T small muted>Bu arada Çalış, Park ve Ben sekmeleri internetsiz de çalışır.</T>
      </Card>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      toast(e?.message ?? 'Bir şey ters gitti.');
    } finally {
      setBusy(false);
    }
  };

  if (!room.room) {
    return (
      <View style={{ gap: 14 }}>
        <Card tint={TINT.sky}>
          <H>Çalışma odaları</H>
          <T muted small>
            Aynı odadakiler birbirini canlı görür: kim çalışıyor, kimin masası boş, kim bitirdi. Beraber sprint başlatabilir, birbirinizi dürtebilirsiniz.
          </T>
          {room.status === 'connecting' && <T small muted>Sunucuya bağlanıyor…</T>}
          {room.status === 'error' && <T small style={{ color: C.danger }}>{room.error}</T>}
        </Card>
        <Card>
          <H size={17}>Odaya katıl</H>
          <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="6 haneli oda kodu" autoCapitalize="characters" maxLength={6} />
          <Btn kind="primary" label="Katıl" disabled={busy || !room.myId} onPress={() => run(() => room.join(code))} />
        </Card>
        <Card>
          <H size={17}>Yeni oda kur</H>
          <Input value={name} onChangeText={setName} placeholder="Örn: Yurt 204 vize kampı" maxLength={40} />
          <Btn label="Oda kur" disabled={busy || !room.myId} onPress={() => run(() => room.create(name))} />
        </Card>
      </View>
    );
  }

  const me = room.members.find((m) => m.uid === room.myId);
  const others = room.members
    .filter((m) => m.uid !== room.myId)
    .sort((a, b) => Number(b.online !== false) - Number(a.online !== false) || a.name.localeCompare(b.name, 'tr'));
  const onlineCount = room.members.filter((m) => m.online !== false).length;
  const working = room.members.filter((m) => m.online !== false && m.state === 'working').length;
  const g = room.group && room.group.endsAt > now ? room.group : null;

  return (
    <View style={{ gap: 14 }}>
      <Card tint={TINT.violet}>
        <Kicker>Oda</Kicker>
        <H>{room.room.name}</H>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text selectable style={{ color: C.accent, fontSize: 30, fontFamily: FONT[800], letterSpacing: 4, fontVariant: ['tabular-nums'] }}>
            {room.room.code}
          </Text>
          <Btn
            small
            label="Kodu paylaş"
            onPress={() => Share.share({ message: `Rota'da çalışma odama gel! Oda kodu: ${room.room!.code}` }).catch(() => {})}
          />
        </View>
        <T small muted>
          {room.status === 'online'
            ? `Odada ${room.members.length} kişi · ${onlineCount} çevrimiçi · ${working} kişi çalışıyor`
            : room.status === 'error'
              ? room.error
              : 'Bağlanıyor…'}
        </T>
      </Card>

      <Card tint={TINT.sun}>
        <H size={17}>Beraber sprint</H>
        {g ? (
          <>
            <T>
              {g.byName} ortak sprint başlattı. Herkes <T bold>{hm(new Date(g.endsAt))}</T>'e kadar çalışıyor ({Math.max(1, Math.ceil((g.endsAt - now) / 60000))} dk kaldı).
            </T>
            <Btn kind="primary" label="Ben de katılıyorum" onPress={() => room.onGroupJoin.current?.(g.endsAt)} />
          </>
        ) : (
          <>
            <T small muted>Odadaki herkese aynı anda başlayıp aynı anda biten bir sprint gönder.</T>
            <Seg value={groupMin} options={[[15, '15 dk'], [25, '25 dk'], [45, '45 dk']]} onChange={setGroupMin} />
            <Btn
              kind="primary"
              label="Herkesle başlat"
              onPress={() => {
                if (!S.session) {
                  toast('Önce Çalış sekmesinde kendi oturumunu başlat.');
                  return;
                }
                room.startGroup(groupMin);
              }}
            />
          </>
        )}
      </Card>

      <Card>
        <H size={17}>Masalar</H>
        {me && <MemberRow m={me} me now={now} />}
        {others.length === 0 && <T small muted>Henüz kimse yok. Oda kodunu arkadaşına gönder.</T>}
        {others.map((m) => (
          <MemberRow key={m.uid} m={m} me={false} now={now} />
        ))}
      </Card>

      <Card tint={TINT.mint}>
        <H size={17}>Bugünün odak saatleri</H>
        {room.board.length === 0 && <T small muted>Bugün henüz biten oturum yok. İlk oturumunu bitirince burada görünürsün.</T>}
        {room.board.map((r, i) => (
          <View key={r.uid} style={[s.row, { justifyContent: 'space-between' }]}>
            <T>
              {i + 1}. {r.name}
            </T>
            <T bold style={{ fontVariant: ['tabular-nums'] }}>
              {r.minutes >= 60 ? `${Math.floor(r.minutes / 60)} sa ${r.minutes % 60} dk` : `${r.minutes} dk`}
            </T>
          </View>
        ))}
        <T small muted>Sıralama yarış için değil, birbirinizi görmek için. Geri dönüşler de sayılır.</T>
      </Card>

      <Btn kind="danger" label="Odadan çık" onPress={room.leave} />
    </View>
  );
}
