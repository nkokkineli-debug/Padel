import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mxdktsejaywvxdlvygqt.supabase.co';
const supabaseKey = 'sb_publishable_f9xowzK8UTQl9nbgqQ3qVg_6Z4ATzvl';

export const supabase = createClient(supabaseUrl, supabaseKey);