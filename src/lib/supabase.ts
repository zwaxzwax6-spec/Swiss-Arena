import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://fqygbnqrlvzlzrumwhcl.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxeWdibnFybHZ6bHpydW13aGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzE2NzksImV4cCI6MjA5NDk0NzY3OX0.lx_qm5j2VqMZ-a3HLd-4xCJQH8TwkFk-OPKdp_FsYBc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
