// /lib/db.ts
import { createClient } from '@supabase/supabase-js';
import { cached, delCache } from './cache';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars');
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const BAL_TTL = Number(process.env.BALANCE_CACHE_TTL_MS ?? 2000);

export async function findUserByPhone(phone: string) {
  const { data, error } = await supabase
    .from('Users')
    .select('id,phone_number,balance,last_charge_date')
    .eq('phone_number', phone)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBalanceFast(phone: string) {
  return cached<{
    exists: boolean;
    balance: number;
    last_charge_date: string;
  }>(`bal:${phone}`, BAL_TTL, async () => {
    const user = await findUserByPhone(phone);
    if (!user) return { exists: false, balance: 0, last_charge_date: '' };
    return {
      exists: true,
      balance: Number(user.balance ?? 0),
      last_charge_date: user.last_charge_date ?? '',
    };
  });
}

export function invalidateBalanceCache(phone: string) {
  delCache(`bal:${phone}`);
}

