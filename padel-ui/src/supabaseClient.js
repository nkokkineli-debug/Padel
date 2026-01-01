import { createClient } from '@supabase/supabase-js';

// --- Supabase Setup uat---
const supabaseUrl = 'https://mxdktsejaywvxdlvygqt.supabase.co';
const supabaseKey = 'sb_publishable_f9xowzK8UTQl9nbgqQ3qVg_6Z4ATzvl';

// --- Supabase Setup dev---
//const supabaseUrl = "https://fugokdpbjjdbvkjgwkhi.supabase.co"
//const supabaseKey = "sb_publishable_JxZkb69GMiMmH8we3nkDoA_UKQxvE6B"

export const supabase = createClient(supabaseUrl, supabaseKey);