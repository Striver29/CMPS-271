import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import type { Course } from '../types';
import { useSupabase } from './useSupabase';

export function useSchedules() {
  const supabase = useSupabase();
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [activeSlot, setActiveSlot] = useState(1);
  const [schedules, setSchedules] = useState<Record<number, Course[]>>({ 1: [], 2: [], 3: [] });

  // Load all 3 schedules from Supabase
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('schedules')
      .select('slot, courses')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!data) return;
        const loaded: Record<number, Course[]> = { 1: [], 2: [], 3: [] };
        data.forEach(row => { loaded[row.slot] = row.courses; });
        setSchedules(loaded);
      });
  }, [supabase, userId]);

  // Save a slot to Supabase
  const saveSlot = useCallback(async (slot: number, courses: Course[]) => {
    if (!userId) return;
    await supabase.from('schedules').upsert(
      { user_id: userId, slot, courses, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,slot' }
    );
  }, [supabase, userId]);

  const scheduled = schedules[activeSlot] ?? [];

  const toggleSchedule = (course: Course) => {
    const current = schedules[activeSlot];
    const exists = current.some(c => c.id === course.id);
    const updated = exists ? current.filter(c => c.id !== course.id) : [...current, course];
    const newSchedules = { ...schedules, [activeSlot]: updated };
    setSchedules(newSchedules);
    saveSlot(activeSlot, updated);
  };

  return { scheduled, activeSlot, setActiveSlot, schedules, toggleSchedule };
}
