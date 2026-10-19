import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'mock-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export async function ensureStorageBuckets(): Promise<void> {
  try {
    const buckets = ['avatars', 'learning-materials', 'trade-receipts'];
    for (const b of buckets) {
      const { data } = await supabase.storage.getBucket(b);
      if (!data) {
        await supabase.storage.createBucket(b, { public: b !== 'trade-receipts' });
      }
    }
  } catch {
    // If using mock credentials or network is offline, continue safely
  }
}
