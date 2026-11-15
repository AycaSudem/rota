import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ago, uid, useStore } from '../store';
import { C } from '../theme';
import { Btn, Card, H, Input, s, Seg, T, TINT, useToast } from '../ui';

export default function Park() {
  const { S, set } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'is' | 'fikir'>('is');
  const add = () => {
    const t = text.trim();
    if (!t) return;
    set((d) => {
      d.park.unshift({ id: uid(), text: t, kind, at: Date.now(), done: false });
    });
    setText('');
    toast('Park edildi.');
  };
  const section = (k: 'is' | 'fikir', title: string, empty: string, note?: string) => {
    const items = S.park.filter((p) => p.kind === k);
    return (
      <Card tint={k === 'fikir' ? TINT.sky : undefined}>
        <H size={17}>{title}</H>
        {note && <T small muted>{note}</T>}
        {items.length === 0 && <T small muted>{empty}</T>}
        {items.map((p) => (
          <View key={p.id} style={s.item}>
            <View style={{ flex: 1 }}>
              <T style={p.done ? { textDecorationLine: 'line-through', color: C.muted } : undefined}>{p.text}</T>
              <T small muted>{ago(p.at)}</T>
            </View>
            {k === 'is' && !p.done && (
              <Btn
                small
                label="Adım yap"
                onPress={() => {
                  set((d) => {
                    const it = d.park.find((x) => x.id === p.id);
                    if (it) it.done = true;
                    if (d.session) d.session.topics.push({ t: p.text, done: false });
                    else d.draft.topics.push(p.text);
                  });
                  toast(S.session ? 'Oturumun sonuna eklendi.' : 'Bir sonraki oturuma eklendi.');
                }}
              />
            )}
            <Pressable
              hitSlop={8}
              accessibilityLabel="Tamamlandı"
              onPress={() =>
                set((d) => {
                  const it = d.park.find((x) => x.id === p.id);
                  if (it) it.done = !it.done;
                })
              }
            >
              <Text style={{ color: C.muted, fontSize: 18 }}>{p.done ? '↺' : '✓'}</Text>
            </Pressable>
            <Pressable hitSlop={8} accessibilityLabel="Sil" onPress={() => set((d) => (d.park = d.park.filter((x) => x.id !== p.id)))}>
              <Text style={{ color: C.muted, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    );
  };
  return (
    <View style={{ gap: 14 }}>
      <Card tint={TINT.violet}>
        <H>Park Alanı</H>
        <T small muted>Aklına gelen işi buraya bırak, elindeki işe dön. Hiçbir şey kaybolmaz.</T>
        <Input value={text} onChangeText={setText} onSubmitEditing={add} placeholder="Örn: Anneme dönüş yap / Podcast fikri" />
        <Seg value={kind} options={[['is', 'Yapılacak iş'], ['fikir', 'Fikir']]} onChange={setKind} />
        <Btn kind="primary" label="Park et" onPress={add} />
      </Card>
      {section('is', 'Yapılacaklar', 'Boş. Aklına bir iş gelince buraya bırak.')}
      {section('fikir', 'Fikir Defteri', 'Henüz fikir yok. İlk fikrin buraya düşecek.', 'Yaratıcılığın burada birikiyor. Ayda bir göz at: hangisi bir projeye dönüşür?')}
    </View>
  );
}
