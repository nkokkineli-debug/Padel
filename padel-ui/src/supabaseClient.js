import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fugokdpbjjdbvkjgwkhi.supabase.co';
const supabaseKey = 'sb_publishable_JxZkb69GMiMmH8we3nkDoA_UKQxvE6B';

export const supabase = createClient(supabaseUrl, supabaseKey);