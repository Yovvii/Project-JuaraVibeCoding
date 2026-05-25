export interface UserProfile {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  morningPerson: boolean;
  bedtime: string;
  wakeTime: string;
  goals: string[];
  screenTimeGoal?: number; // in minutes
  language: 'ID' | 'EN';
  notificationsEnabled: boolean;
  allowedDays?: string[]; // ['Mon', 'Tue', ...]
  allowedStartTime?: string; // HH:mm
  allowedEndTime?: string; // HH:mm
  stats?: {
    streak: number;
    completed: number;
    uncompleted: number;
  };
  streakTotal?: number;
  completedTasks?: number;
  uncompletedTasks?: number;
  screenTimeSeconds?: number;
  createdAt?: any;
  displayName?: string;
}

export type HabitCategory = 'Hobi' | 'Kerja' | 'Belajar' | 'Hiburan' | 'Personal';

export interface Habit {
  id?: string;
  userId: string;
  title: string;
  category: HabitCategory;
  preferredTime: string;
  durationMinutes: number;
}

export interface ScheduleItem {
  id?: string;
  userId: string;
  title: string;
  startTime: string; // ISO string or HH:mm
  endTime: string;
  category: string;
  status: 'pending' | 'completed' | 'missed' | 'rescheduled';
  isAIRecommended?: boolean;
  isManual?: boolean;
  date?: string; // YYYY-MM-DD
  day?: string; // Monday, Tuesday, etc.
}
