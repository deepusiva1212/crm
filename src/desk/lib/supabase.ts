import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const STORAGE_BUCKET = 'desk-attachments';

export async function uploadAttachment(
  ticketId: string,
  file: File,
  userId: string
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${ticketId}/${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file);

  if (error) throw error;
  return path;
}

export function getPublicUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}