const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || "https://lczhwfwdpwrlepoajymz.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_kd7NLlJ6LtGcUjQLp5p25g_jVL0HGkl";

let supabase;
try {
    supabase = createClient(supabaseUrl, supabaseKey);
} catch (err) {
    console.error("Failed to initialize Supabase client:", err.message);
    supabase = {
        from: () => ({
            select: () => ({
                eq: () => ({ single: async () => ({ data: null, error: true }), limit: async () => ({ data: [], error: true }) }),
                order: () => ({ limit: async () => ({ data: [], error: true }) })
            }),
            insert: () => ({ select: () => ({ single: async () => ({ data: null, error: true }) }) }),
            update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: true }) }) }) })
        })
    };
}

module.exports = supabase;
