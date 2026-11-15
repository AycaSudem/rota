import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cur, left, useStore } from './store';
import { configured, ensureUser, explain, supabase } from './supabase';
import { useToast } from './ui';

export type MemberState = 'working' | 'break' | 'away' | 'phone' | 'idle' | 'done';
export type Meta = {
  uid: string;
  name: string;
  state: MemberState;
  topic: string;
  left: number;
  total: number;
  phaseEnd: number;
  place: boolean;
  groupEndsAt: number;
  /** Şu an Rota'sı açık mı (canlı bağlantı) */
  online?: boolean;
  /** Çevrimdışıysa son görülme zamanı (ms) */
  seenAt?: number;
};
export type Group = { endsAt: number; min: number; byName: string };
export type BoardRow = { uid: string; name: string; minutes: number };
type Status = 'off' | 'connecting' | 'online' | 'error';

type Ctx = {
  configured: boolean;
  status: Status;
  error: string;
  myId: string | null;
  room: { code: string; name: string } | null;
  members: Meta[];
  group: Group | null;
  board: BoardRow[];
  create: (name: string) => Promise<void>;
  join: (code: string) => Promise<void>;
  leave: () => void;
  poke: (to: string, kind: 'poke' | 'cheer', msg: string) => void;
  startGroup: (min: number) => void;
  refreshBoard: () => void;
  logFocus: (minutes: number, done: number) => void;
  onGroupJoin: React.MutableRefObject<((endsAt: number) => void) | null>;
};
const RoomCtx = createContext<Ctx | null>(null);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const { S, set, ref } = useStore();
  const toast = useToast();
  const [status, setStatus] = useState<Status>(configured ? 'connecting' : 'off');
  const [error, setError] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [room, setRoom] = useState<{ code: string; name: string } | null>(null);
  const [live, setLive] = useState<Meta[]>([]);
  const [saved, setSaved] = useState<Record<string, Meta>>({});
  const [groupMsg, setGroupMsg] = useState<Group | null>(null);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const ch = useRef<RealtimeChannel | null>(null);
  const subscribed = useRef(false);
  const roomRef = useRef<{ code: string; name: string } | null>(null);
  roomRef.current = room;
  const myIdRef = useRef<string | null>(null);
  myIdRef.current = myId;
  const lastSave = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMembersFetch = useRef(0);
  const onGroupJoin = useRef<((endsAt: number) => void) | null>(null);

  /* Benim yayınladığım durum */
  const meta: Meta | null = useMemo(() => {
    if (!myId) return null;
    const s = S.session;
    const state: MemberState = s ? (s.elsewhere ? 'phone' : s.away ? 'away' : s.phase === 'break' ? 'break' : 'working') : S.myState;
    return {
      uid: myId,
      name: S.name || 'İsimsiz',
      state,
      topic: cur(s)?.t ?? '',
      left: left(s).length,
      total: s ? s.topics.length : 0,
      phaseEnd: s && s.phase !== 'await' ? s.phaseEnd : 0,
      place: !!s?.place,
      groupEndsAt: groupMsg && groupMsg.endsAt > Date.now() ? groupMsg.endsAt : 0,
    };
  }, [myId, S.session, S.myState, S.name, groupMsg]);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const metaKey = meta ? JSON.stringify(meta) : '';
  /* Oda üyeliği veritabanında da tutulur: Rota'sı kapalı olan arkadaşlar da listede görünür. */
  const saveMember = useCallback(
    (now = false) => {
      const code = ref.current.roomCode;
      const m = metaRef.current;
      if (!configured || !code || !m) return;
      const run = () => {
        lastSave.current = Date.now();
        supabase
          .from('room_members')
          .upsert(
            {
              room_code: code,
              user_id: m.uid,
              name: (m.name || 'İsimsiz').slice(0, 30),
              state: m.state,
              topic: (m.topic || '').slice(0, 120),
              left_count: Math.min(500, m.left),
              total: Math.min(500, m.total),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'room_code,user_id' },
          )
          .then(() => {});
      };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const wait = 10000 - (Date.now() - lastSave.current);
      if (now || wait <= 0) run();
      else saveTimer.current = setTimeout(run, wait);
    },
    [ref],
  );

  const refreshMembers = useCallback(async () => {
    const code = ref.current.roomCode;
    if (!configured || !code) return;
    lastMembersFetch.current = Date.now();
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data, error: e } = await supabase
      .from('room_members')
      .select('user_id,name,state,topic,left_count,total,updated_at')
      .eq('room_code', code)
      .gte('updated_at', since)
      .limit(200);
    if (e || !data) return; // tablo henüz kurulmadıysa sessizce geç
    const map: Record<string, Meta> = {};
    data.forEach((r: { user_id: string; name: string; state: string; topic: string | null; left_count: number | null; total: number | null; updated_at: string }) => {
      map[r.user_id] = {
        uid: r.user_id,
        name: r.name,
        state: (r.state as MemberState) || 'idle',
        topic: r.topic ?? '',
        left: r.left_count ?? 0,
        total: r.total ?? 0,
        phaseEnd: 0,
        place: false,
        groupEndsAt: 0,
        online: false,
        seenAt: Date.parse(r.updated_at),
      };
    });
    setSaved(map);
  }, [ref]);

  useEffect(() => {
    if (ch.current && subscribed.current && metaRef.current) ch.current.track(metaRef.current).catch(() => {});
    if (roomRef.current) saveMember();
  }, [metaKey, saveMember]);

  /* Liste: çevrimiçi olanlar canlı, diğerleri son kayıtlı durumlarıyla */
  const members: Meta[] = useMemo(() => {
    const onlineIds = new Set(live.map((m) => m.uid));
    const offline = Object.values(saved).filter((m) => !onlineIds.has(m.uid));
    return [...live.map((m) => ({ ...m, online: true })), ...offline];
  }, [live, saved]);

  /* Liderlik tablosu (bugün) */
  const refreshBoard = useCallback(async () => {
    const code = ref.current.roomCode;
    if (!configured || !code) return;
    const { data, error: e } = await supabase
      .from('focus_logs')
      .select('user_id,name,minutes')
      .eq('room_code', code)
      .gte('created_at', startOfToday())
      .limit(1000);
    if (e || !data) return;
    const agg: Record<string, BoardRow> = {};
    data.forEach((r: { user_id: string; name: string; minutes: number }) => {
      const a = (agg[r.user_id] ||= { uid: r.user_id, name: r.name, minutes: 0 });
      a.minutes += r.minutes;
      a.name = r.name;
    });
    setBoard(Object.values(agg).sort((a, b) => b.minutes - a.minutes));
  }, [ref]);

  const disconnect = useCallback(() => {
    if (ch.current) supabase.removeChannel(ch.current);
    ch.current = null;
    subscribed.current = false;
    setLive([]);
    setSaved({});
  }, []);

  const connect = useCallback(
    (code: string, name: string, uidv: string) => {
      disconnect();
      setRoom({ code, name });
      setStatus('connecting');
      const c = supabase.channel('room:' + code, { config: { presence: { key: uidv }, broadcast: { self: false } } });
      c.on('presence', { event: 'sync' }, () => {
        const st = c.presenceState<Meta>();
        const list: Meta[] = [];
        Object.values(st).forEach((arr) => {
          const last = arr[arr.length - 1];
          if (last) list.push(last as unknown as Meta);
        });
        setLive(list);
        if (Date.now() - lastMembersFetch.current > 5000) refreshMembers();
      });
      c.on('broadcast', { event: 'poke' }, ({ payload }) => {
        const p = payload as { to: string; fromName: string; kind: string; msg: string };
        if (!p || p.to !== uidv) return;
        const text = String(p.msg || '').slice(0, 200);
        const from = String(p.fromName || 'Arkadaşın').slice(0, 30);
        Haptics.notificationAsync(p.kind === 'cheer' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
        toast(from + ': ' + text, undefined, 9000);
        if (ref.current.session) set((d) => { if (d.session) d.session.bubble = from + ' diyor ki: ' + text; });
      });
      c.on('broadcast', { event: 'group' }, ({ payload }) => {
        const g = payload as Group;
        if (!g || typeof g.endsAt !== 'number' || g.endsAt < Date.now()) return;
        setGroupMsg(g);
        toast(String(g.byName).slice(0, 30) + ' ' + g.min + ' dakikalık ortak sprint başlattı!', { label: 'Katıl', onPress: () => onGroupJoin.current?.(g.endsAt) }, 12000);
      });
      c.subscribe((st) => {
        if (st === 'SUBSCRIBED') {
          subscribed.current = true;
          setStatus('online');
          setError('');
          if (metaRef.current) c.track(metaRef.current).catch(() => {});
          saveMember(true);
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
          subscribed.current = false;
          setStatus('error');
          setError('Canlı bağlantı kurulamadı, tekrar deneniyor. Oda listesi yine de güncelleniyor.');
        } else if (st === 'CLOSED') {
          subscribed.current = false;
        }
      });
      ch.current = c;
      refreshBoard();
      refreshMembers();
    },
    [disconnect, refreshBoard, refreshMembers, saveMember, set, toast, ref],
  );

  /* Açılışta anonim giriş + son odaya otomatik dönüş */
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    ensureUser()
      .then(async (id) => {
        if (!alive || !id) return;
        setMyId(id);
        const code = ref.current.roomCode;
        if (code) {
          const { data } = await supabase.from('rooms').select('code,name').eq('code', code).maybeSingle();
          if (data) connect(data.code, data.name, id);
          else {
            set((d) => { d.roomCode = null; });
            setStatus('online');
          }
        } else setStatus('online');
      })
      .catch((e) => {
        setStatus('error');
        setError(explain(e?.message ?? 'Sunucuya bağlanılamadı.'));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Uygulamaya dönünce varlığı yenile */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        const r = roomRef.current;
        const id = myIdRef.current;
        const state = (ch.current as unknown as { state?: string } | null)?.state;
        if (r && id && (!ch.current || !subscribed.current || (state && state !== 'joined'))) connect(r.code, r.name, id);
        else if (ch.current && subscribed.current && metaRef.current) ch.current.track(metaRef.current).catch(() => {});
        refreshBoard();
        refreshMembers();
      } else if (st === 'background' && roomRef.current) {
        saveMember(true);
      }
    });
    const iv = setInterval(refreshBoard, 120000);
    const iv2 = setInterval(() => {
      if (AppState.currentState === 'active') refreshMembers();
    }, 30000);
    return () => {
      sub.remove();
      clearInterval(iv);
      clearInterval(iv2);
    };
  }, [refreshBoard, refreshMembers, saveMember, connect]);

  const create = useCallback(
    async (name: string) => {
      if (!myId) throw new Error('Sunucuya bağlı değilsin.');
      const nm = name.trim().slice(0, 40) || 'Çalışma odası';
      for (let i = 0; i < 4; i++) {
        const code = newCode();
        const { error: e } = await supabase.from('rooms').insert({ code, name: nm });
        if (!e) {
          set((d) => { d.roomCode = code; });
          connect(code, nm, myId);
          return;
        }
        if (e.code !== '23505') throw new Error(explain(e.message));
      }
      throw new Error('Oda kodu üretilemedi, tekrar dene.');
    },
    [myId, connect, set],
  );

  const join = useCallback(
    async (codeIn: string) => {
      if (!myId) throw new Error('Sunucuya bağlı değilsin.');
      const code = codeIn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) throw new Error('Oda kodu 6 karakter olmalı.');
      const { data, error: e } = await supabase.from('rooms').select('code,name').eq('code', code).maybeSingle();
      if (e) throw new Error(explain(e.message));
      if (!data) throw new Error('Bu kodla bir oda bulunamadı.');
      set((d) => { d.roomCode = data.code; });
      connect(data.code, data.name, myId);
    },
    [myId, connect, set],
  );

  const leave = useCallback(() => {
    const code = ref.current.roomCode;
    if (configured && code && myIdRef.current) supabase.from('room_members').delete().eq('room_code', code).eq('user_id', myIdRef.current).then(() => {});
    disconnect();
    setRoom(null);
    setBoard([]);
    setGroupMsg(null);
    set((d) => { d.roomCode = null; });
  }, [disconnect, set, ref]);

  const poke = useCallback(
    (to: string, kind: 'poke' | 'cheer', msg: string) => {
      if (!ch.current) return;
      ch.current
        .send({ type: 'broadcast', event: 'poke', payload: { to, kind, msg: msg.slice(0, 200), fromName: ref.current.name || 'Arkadaşın' } })
        .then(() => toast(kind === 'cheer' ? 'Alkış gönderildi.' : 'Dürtüldü!'))
        .catch(() => toast('Gönderilemedi.'));
    },
    [toast, ref],
  );

  const startGroup = useCallback(
    (min: number) => {
      if (!ch.current) return;
      const g: Group = { endsAt: Date.now() + min * 60000, min, byName: ref.current.name || 'Biri' };
      setGroupMsg(g);
      ch.current.send({ type: 'broadcast', event: 'group', payload: g }).catch(() => {});
      onGroupJoin.current?.(g.endsAt);
    },
    [ref],
  );

  const logFocus = useCallback(
    (minutes: number, done: number) => {
      if (!configured || !myId || minutes < 1) return;
      supabase
        .from('focus_logs')
        .insert({ room_code: ref.current.roomCode, name: (ref.current.name || 'İsimsiz').slice(0, 30), minutes: Math.min(600, minutes), topics_done: Math.min(200, done) })
        .then(() => refreshBoard());
    },
    [myId, refreshBoard, ref],
  );

  /* Ortak sprint: yayından ya da odadakilerin durumundan */
  const group: Group | null = useMemo(() => {
    const now = Date.now();
    if (groupMsg && groupMsg.endsAt > now) return groupMsg;
    const m = members.filter((x) => x.groupEndsAt > now).sort((a, b) => b.groupEndsAt - a.groupEndsAt)[0];
    return m ? { endsAt: m.groupEndsAt, min: Math.round((m.groupEndsAt - now) / 60000), byName: m.name } : null;
  }, [groupMsg, members]);

  return (
    <RoomCtx.Provider
      value={{ configured, status, error, myId, room, members, group, board, create, join, leave, poke, startGroup, refreshBoard, logFocus, onGroupJoin }}
    >
      {children}
    </RoomCtx.Provider>
  );
}

export function useRoom() {
  const c = useContext(RoomCtx);
  if (!c) throw new Error('RoomProvider yok');
  return c;
}
