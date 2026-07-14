import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config } from '../config';

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
}

export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: { persistSession: false },
    // ws requerido en Node < 22 que no tiene WebSocket nativo
    realtime: { transport: ws as unknown as typeof WebSocket },
  }
);
