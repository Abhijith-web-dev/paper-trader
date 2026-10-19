import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const filePath = `${userId}/${Date.now()}_${file.name}`;
  try {
    const { data, error } = await supabase.storage.from('avatars').upload(filePath, file);
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.warn('Supabase avatar upload fallback (demo mode):', err?.message);
    return URL.createObjectURL(file);
  }
}
