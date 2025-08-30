// /lib/fetcher.ts
import { apiFetch } from "./api";

export const fetcher = (url: string) =>
  apiFetch(url, { cache: "no-store", lockUI: false }).then((r) => r.json());
