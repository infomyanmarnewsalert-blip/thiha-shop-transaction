// /lib/push.ts
import "server-only";

/** UIからも呼びやすい共通ペイロード型（必要に応じて拡張OK） */
export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: any;
};

/** 現状は常に false（将来、環境変数でONにしたら true を返す構造に変えやすい） */
export function isPushReady() {
  return false;
}

/** 何もしない安全版（awaitしても即解決） */
export async function notifyAdmins(
  _titleOrPayload: string | PushPayload,
  _body?: string
) {
  // no-op
  return;
}

/** 互換用：既存コードで webpush を直接参照していても落ちないダミー */
type WebPushLike = { sendNotification: (..._args: any[]) => Promise<void> };
const noopWebPush: WebPushLike = { sendNotification: async () => {} };

/** 互換用エクスポート（既存の import { webpush } from '@/lib/push' を壊さない） */
export const webpush: WebPushLike = noopWebPush;

/** 互換用エクスポート（既存の getWebPush() を壊さない） */
export function getWebPush(): WebPushLike {
  return noopWebPush;
}
