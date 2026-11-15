import {
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TONES } from './src/bekci';
import { ConfettiProvider } from './src/garden';
import { markTouch } from './src/motion';
import { askNotifications, initNotifications, notificationStatus } from './src/notify';
import { RoomProvider, useRoom } from './src/room';
import Me from './src/screens/Me';
import Park from './src/screens/Park';
import Room from './src/screens/Room';
import Study from './src/screens/Study';
import { anchorInfo, SessionProvider } from './src/session';
import { hm, StoreProvider, useStore } from './src/store';
import { C, FONT } from './src/theme';
import { Btn, Card, H, Input, Lantern, NavProvider, SheetProvider, T, Tab, ToastProvider, useNav } from './src/ui';

function AnchorBar() {
  const { S, set } = useStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(id);
  }, []);
  if (!S.anchor) return null;
  const info = anchorInfo(S.anchor);
  if (info.target.getTime() < Date.now() - 3600000) return null;
  const urgent = info.min <= 10;
  const lbl = S.anchor.label ? S.anchor.label + ' için ' : '';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        backgroundColor: urgent ? C.danger : C.skySoft,
      }}
    >
      <Text style={{ color: urgent ? '#fff' : C.ink, fontFamily: FONT[700], flex: 1 }}>
        ⏰{' '}
        {info.min > 0
          ? `${lbl}çıkış ${hm(info.leave)} · ${info.min >= 60 ? Math.floor(info.min / 60) + ' sa ' + (info.min % 60) + ' dk' : info.min + ' dk'} var`
          : `${lbl}çıkma zamanı geldi (${hm(info.leave)})`}
      </Text>
      <Pressable onPress={() => set((d) => (d.anchor = null))} hitSlop={8}>
        <Text style={{ color: urgent ? '#fff' : C.muted, fontFamily: FONT[700] }}>Kapat</Text>
      </Pressable>
    </View>
  );
}

/** Son 30 dakikada ekranın kenarı yanar, son 10 dakikada kırmızı olur. */
function AnchorEdge() {
  const { S } = useStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(id);
  }, []);
  if (!S.anchor) return null;
  const info = anchorInfo(S.anchor);
  if (info.min > 30 || info.target.getTime() < Date.now() - 3600000) return null;
  const urgent = info.min <= 10;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: urgent ? 7 : 5, borderColor: urgent ? C.danger : C.sky }]} />;
}

/** Bildirimler kapalıysa: Bekçi arka planda haber veremez, bunu açıkça söyle. */
function NotifBanner() {
  const [st, setSt] = useState<{ granted: boolean; canAsk: boolean } | null>(null);
  const check = useCallback(() => {
    notificationStatus().then(setSt);
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (a) => a === 'active' && check());
    return () => sub.remove();
  }, [check]);
  if (Platform.OS === 'web' || !st || st.granted) return null;
  return (
    <View style={{ backgroundColor: C.coralSoft, borderRadius: 18, padding: 14, gap: 8, marginBottom: 12 }}>
      <T bold>🔔 Bildirimler kapalı</T>
      <T small>Rota kapalıyken mola bitişini, "Orada mısın?" yoklamasını ve Zaman Çapası'nı haber veremez.</T>
      <Btn
        small
        kind="primary"
        label={st.canAsk ? 'Bildirimlere izin ver' : 'Ayarlardan aç'}
        onPress={() => {
          if (st.canAsk) askNotifications().then(check);
          else Linking.openSettings().catch(() => {});
        }}
      />
    </View>
  );
}

const TABS: [Tab, string, string][] = [
  ['calis', 'Çalış', '⏱️'],
  ['oda', 'Oda', '🏠'],
  ['park', 'Park', '💭'],
  ['ben', 'Ben', '🌿'],
];

function Onboarding() {
  const { set } = useStore();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const go = async () => {
    const n = name.trim();
    if (!n) return;
    await initNotifications();
    set((d) => (d.name = n));
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 20, paddingTop: insets.top }}>
      <Card style={{ padding: 22, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Lantern size={44} />
          <H size={32}>Rota</H>
        </View>
        <T>
          DEHB'li beyin için bekçili çalışma arkadaşın. Telefonu bırakıp çalışırsın; kalkarsan Bekçi nazikçe sorar, arkadaşlarınla aynı odada çalışırsın ve
          odaklandıkça bahçen büyür 🌱
        </T>
        <View style={{ backgroundColor: C.sunSoft, borderRadius: 16, padding: 12, display: Platform.OS === 'web' ? 'none' : 'flex' }}>
          <T small>
            🔔 Bir sonraki adımda telefon <T small bold>bildirim izni</T> isteyecek. Lütfen izin ver; yoksa Rota kapalıyken mola bitişini ve hatırlatmaları
            haber veremem.
          </T>
        </View>
        <T bold small>
          Odada görünecek adın
        </T>
        <Input value={name} onChangeText={setName} placeholder="Örn: Ayşe" maxLength={30} onSubmitEditing={go} />
        <Btn kind="primary" big label="Başlayalım 🌱" disabled={!name.trim()} onPress={go} />
      </Card>
    </KeyboardAvoidingView>
  );
}

function Shell() {
  const { S } = useStore();
  const { tab, setTab } = useNav();
  const room = useRoom();
  const insets = useSafeAreaInsets();
  const openPark = S.park.filter((p) => !p.done && p.kind === 'is').length;

  if (!S.name) return <Onboarding />;

  return (
    <View style={{ flex: 1 }} onTouchStart={markTouch}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 110, maxWidth: 560, width: '100%', alignSelf: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Lantern size={30} light />
            </View>
            <View>
              <H size={24}>Rota</H>
              <T small muted>
                {room.room ? `${room.room.name} · ${room.members.length} kişi` : 'Bekçili çalışma arkadaşın'}
              </T>
            </View>
          </View>
          <Pressable onPress={() => setTab('ben')} style={{ backgroundColor: C.sunSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: C.sunDeep, fontSize: 13, fontFamily: FONT[600] }}>
              Bekçi: <Text style={{ fontFamily: FONT[800] }}>{TONES[S.tone].name}</Text>
            </Text>
          </Pressable>
        </View>
        <NotifBanner />
        <AnchorBar />
        {tab === 'calis' && <Study />}
        {tab === 'oda' && <Room />}
        {tab === 'park' && <Park />}
        {tab === 'ben' && <Me />}
      </ScrollView>
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 10, alignItems: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: C.surface,
            borderRadius: 26,
            padding: 6,
            width: '100%',
            maxWidth: 520,
            shadowColor: '#5B43E0',
            shadowOpacity: 0.18,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          {TABS.map(([k, label, icon]) => {
            const on = tab === k;
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 20, backgroundColor: on ? C.accentSoft : 'transparent' }}
              >
                <Text style={{ fontSize: 20 }}>{icon}</Text>
                <Text style={{ color: on ? C.accentDeep : C.muted, fontSize: 12.5, fontFamily: FONT[on ? 800 : 600] }}>{label}</Text>
                {k === 'park' && openPark > 0 && (
                  <View style={{ position: 'absolute', top: 2, right: '22%', backgroundColor: C.coral, borderRadius: 999, minWidth: 18, paddingHorizontal: 5 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontFamily: FONT[800], textAlign: 'center' }}>{openPark}</Text>
                  </View>
                )}
                {k === 'oda' && room.room && (
                  <View style={{ position: 'absolute', top: 6, right: '26%', width: 9, height: 9, borderRadius: 5, backgroundColor: room.status === 'online' ? C.mint : C.danger }} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
      <AnchorEdge />
    </View>
  );
}

function Gate() {
  const { loaded } = useStore();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <NavProvider>
      <ToastProvider>
        <SheetProvider>
          <RoomProvider>
            <ConfettiProvider>
              <SessionProvider>
                <Shell />
              </SessionProvider>
            </ConfettiProvider>
          </RoomProvider>
        </SheetProvider>
      </ToastProvider>
    </NavProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="dark" />
        {fontsLoaded || fontError ? (
          <StoreProvider>
            <Gate />
          </StoreProvider>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}
