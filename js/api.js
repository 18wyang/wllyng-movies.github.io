import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://izxulcoegocgkbeqzjyg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fTwXlzd68DIl4TbL6eiLAg_KIcMQxs6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function getUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*');
        
    if (error) {
        console.error("Error fetching users:", error);
        return [];
    }
    return data || [];
}

export async function saveUser(name, ratings) {
    const { error } = await supabase
        .from('users')
        .upsert({ name: name, ratings: ratings }, { onConflict: 'name' });
        
    if (error) {
        console.error("Error saving user:", error);
    }
}

export async function deleteUser(name) {
    const { error } = await supabase
        .from('users')
        .delete()
        .eq('name', name);
        
    if (error) {
        console.error("Error deleting user:", error);
    }
}

export async function clearAllUsers() {
    const { error } = await supabase
        .from('users')
        .delete()
        .neq('name', 'nevermatchthisstring'); // hacky way to delete all
        
    if (error) {
        console.error("Error clearing users:", error);
    }
}

export async function getSettings() {
    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'global')
        .single();
        
    if (error) {
        // If row doesn't exist, Create fallback
        return { matchmaker_revealed: false, final_matches: [] };
    }
    return data;
}

export async function updateSettings(revealed, finalMatches) {
    const { error } = await supabase
        .from('settings')
        .update({ 
            matchmaker_revealed: revealed, 
            final_matches: finalMatches 
        })
        .eq('id', 'global');
        
    if (error) {
        console.error("Error updating settings:", error);
    }
}
