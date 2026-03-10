import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://aetdyzoxwdvycjcpaeho.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldGR5em94d2R2eWNqY3BhZWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzM0NjAsImV4cCI6MjA4MzEwOTQ2MH0.ScNICp5vV6rN2p--T4EpRxxxoh8LT_A6Qqb2w0BiuP8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
