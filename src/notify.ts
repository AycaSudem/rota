import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let ready = false;
export async function initNotifications() {
  if (ready) return;
  ready = true;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bekci', {
        name: 'Bekçi',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
      });
    }
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted) await Notifications.requestPermissionsAsync();
  } catch {
    // izin verilmezse uygulama bildirimsiz çalışır
  }
}

/** Bildirim izni durumu (uyarı şeridi için). */
export async function notificationStatus(): Promise<{ granted: boolean; canAsk: boolean }> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return { granted: p.granted, canAsk: p.canAskAgain };
  } catch {
    return { granted: true, canAsk: false };
  }
}
export async function askNotifications(): Promise<boolean> {
  try {
    const r = await Notifications.requestPermissionsAsync();
    return r.granted;
  } catch {
    return false;
  }
}

export type Tag = 'phase' | 'desk' | 'away' | 'anchor30' | 'anchor0';
const ids: Partial<Record<Tag, string>> = {};

/** Aynı etiketli eski bildirimi iptal edip yenisini kurar. */
export async function schedule(tag: Tag, at: number, title: string, body: string) {
  await cancel(tag);
  const secs = Math.round((at - Date.now()) / 1000);
  if (secs < 2) return;
  try {
    ids[tag] = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secs, channelId: 'bekci' },
    });
  } catch {
    // yoksay
  }
}

export async function cancel(tag: Tag) {
  const id = ids[tag];
  if (!id) return;
  delete ids[tag];
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // yoksay
  }
}

export async function cancelSession() {
  await Promise.all((['phase', 'desk', 'away'] as Tag[]).map(cancel));
}
