import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useRealtime = (
  table: string,
  callback: (payload: any) => void,
  filter?: string
) => {
  useEffect(() => {
    let channel = supabase.channel(`public:${table}`);

    if (filter) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        (payload) => callback(payload)
      );
    } else {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => callback(payload)
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback, filter]);
};
