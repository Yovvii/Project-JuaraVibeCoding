/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User, signOut } from "firebase/auth";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, where, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { Calendar } from "./components/Calendar";
import { HabitManager } from "./components/HabitManager";
import { AISidebar } from "./components/AISidebar";
import { DashboardStats } from "./components/DashboardStats";
import { SettingsPanel } from "./components/SettingsPanel";
import { Habit, ScheduleItem, UserProfile } from "./types";
import { LogIn, User as UserIcon, LayoutDashboard, Settings, LogOut, Home, BarChart2, Sparkles, Target } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { translations } from "./lib/translations";

type View = 'dashboard' | 'stats' | 'settings';
type CalendarView = 'daily' | 'weekly' | 'monthly';

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [schedule, setSchedule] = React.useState<ScheduleItem[]>([]);

  // Specific local state hooks for targeting, streaks, database synchronization, and purging
  const [targets, setTargetsState] = React.useState<any[]>([]);
  const [schedules, setSchedulesState] = React.useState<any[]>([]);
  const [streak, setStreak] = React.useState<number>(0);
  const [screenTime, setScreenTime] = React.useState<number>(0);

  // Clean 0-state validation and local hook interference guards
  const [streakTotal, setStreakTotal] = React.useState<number>(0);
  const [completedTasks, setCompletedTasks] = React.useState<number>(0);

  // Clear sticky React state memory immediately before component mounts
  React.useLayoutEffect(() => {
    setStreakTotal(0);
    setCompletedTasks(0);
  }, []);

  const setTargets = (val: any) => {
    setTargetsState(val);
    setHabits(val);
  };

  const setSchedules = (val: any) => {
    setSchedulesState(val);
    setSchedule(val);
  };
  const [manualSchedule, setManualSchedule] = React.useState<ScheduleItem[]>(() => {
    try {
      const saved = localStorage.getItem('disiplin_manual_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isInitialAppMounting, setIsInitialAppMounting] = React.useState(true);
  const [isSplashActive, setIsSplashActive] = React.useState(true);

  React.useEffect(() => {
    if (!isInitialAppMounting) {
      const timer = setTimeout(() => {
        setIsSplashActive(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isInitialAppMounting]);
  const [currentView, setCurrentView] = React.useState<View>('dashboard');
  const [calendarView, setCalendarView] = React.useState<CalendarView>('daily');
  const [activeDayContext, setActiveDayContext] = React.useState<string>(new Date().toLocaleDateString('en-CA'));
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = React.useState(false);
  const [isScheduleLoading, setIsScheduleLoading] = React.useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = React.useState(false);
  const [pendingItems, setPendingItems] = React.useState<any[]>([]);
  const [pendingScope, setPendingScope] = React.useState<string>('daily');
  const [refreshKey, setRefreshKey] = React.useState<string>(crypto.randomUUID());
  const [isDarkMode, setIsDarkMode] = React.useState<boolean>(() => {
    return localStorage.getItem("disiplin_settings_dark_mode") === "true";
  });
  const [scrollDirection, setScrollDirection] = React.useState<'up' | 'down'>('up');
  const [lastScrollTop, setLastScrollTop] = React.useState(0);
  const [activeMobileDrawer, setActiveMobileDrawer] = React.useState<'habits' | 'ai' | null>(null);

  // Detect Scroll Direction via Window Events
  React.useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleWindowScroll = () => {
      // Track the current window.scrollY position against the previous scroll position
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > lastScrollTop && scrollTop > 50) {
      setScrollDirection('down');
    } else if (scrollTop < lastScrollTop) {
      setScrollDirection('up');
    }
    setLastScrollTop(scrollTop);
  };

  const toggleDarkMode = () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    localStorage.setItem("disiplin_settings_dark_mode", String(newVal));
  };

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const triggerRefresh = () => setRefreshKey(crypto.randomUUID());

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setTargets([]);
      setSchedules([]);
      setStreak(0);
      setScreenTime(0);
      setUser(u);
      if (u) {
        const cachedUid = localStorage.getItem("last_authorized_uid");
        if (cachedUid && cachedUid !== u.uid) {
          localStorage.removeItem('chronos_screen_time_seconds');
          localStorage.removeItem('chronos_screen_time_daily_logs');
          localStorage.removeItem('chronos_chart_data');
          localStorage.removeItem('disiplin_manual_tasks');
          window.dispatchEvent(new Event('chronos_screen_time_reset'));
        }
        localStorage.setItem("last_authorized_uid", u.uid);

        // Sync saved user sessions list
        try {
          const sessionsStr = localStorage.getItem("saved_user_sessions");
          let sessions = sessionsStr ? JSON.parse(sessionsStr) : [];
          const email = u.email || "";
          const name = u.displayName || "User";
          
          if (!sessions.some((s: any) => s.email === email)) {
            sessions.push({ email, name });
            localStorage.setItem("saved_user_sessions", JSON.stringify(sessions));
          }
        } catch (e) {
          console.warn("Failed to sync auth session log:", e);
        }

        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const docSnap = userSnap;
          const activeStreak = docSnap.exists() ? (docSnap.data().streakTotal ?? 0) : 0;
          const activeCompleted = docSnap.exists() ? (docSnap.data().completedTasks ?? 0) : 0;
          const data = docSnap.data();
          const mappedProfile: UserProfile = {
            uid: u.uid,
            displayName: data.displayName || u.displayName || "User Baru",
            name: data.name || u.displayName || "User Baru",
            email: data.email || u.email || "",
            photoURL: data.photoURL || u.photoURL || "",
            morningPerson: data.morningPerson ?? true,
            bedtime: data.bedtime || "22:00",
            wakeTime: data.wakeTime || "06:00",
            goals: data.goals || [],
            language: data.language || 'ID',
            notificationsEnabled: data.notificationsEnabled ?? true,
            screenTimeGoal: data.screenTimeGoal ?? 360,
            allowedDays: data.allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            allowedStartTime: data.allowedStartTime || "08:00",
            allowedEndTime: data.allowedEndTime || "22:00",
            streakTotal: activeStreak,
            completedTasks: activeCompleted,
            uncompletedTasks: docSnap.exists() ? (docSnap.data().uncompletedTasks ?? 0) : 0,
            screenTimeSeconds: docSnap.exists() ? (docSnap.data().screenTimeSeconds ?? 0) : 0,
            createdAt: data.createdAt || new Date(),
            stats: {
              streak: data.stats?.streak ?? activeStreak,
              completed: data.stats?.completed ?? activeCompleted,
              uncompleted: data.stats?.uncompleted ?? (docSnap.data().uncompletedTasks ?? 0)
            }
          };
          setProfile(mappedProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName || "User Baru",
            name: u.displayName || "User Baru",
            email: u.email || "",
            photoURL: u.photoURL || "",
            morningPerson: true,
            bedtime: "22:00",
            wakeTime: "06:00",
            goals: [],
            language: 'ID',
            notificationsEnabled: true,
            screenTimeGoal: 360,
            allowedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            allowedStartTime: "08:00",
            allowedEndTime: "22:00",
            streakTotal: 0,
            completedTasks: 0,
            uncompletedTasks: 0,
            screenTimeSeconds: 0,
            createdAt: new Date(),
            stats: {
              streak: 0,
              completed: 0,
              uncompleted: 0
            }
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        }
      }
      setIsInitialAppMounting(false);
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!user) return;

    // Listen to profile mapping fallback values live
    const userRef = doc(db, "users", user.uid);
    const unsubProfile = onSnapshot(userRef, (docSnap) => {
      const activeStreak = docSnap.exists() ? (docSnap.data()?.streakTotal ?? 0) : 0;
      const activeCompleted = docSnap.exists() ? (docSnap.data()?.completedTasks ?? 0) : 0;
      const activeUncompleted = docSnap.exists() ? (docSnap.data()?.uncompletedTasks ?? 0) : 0;
      const activeScreenTimeSeconds = docSnap.exists() ? (docSnap.data()?.screenTimeSeconds ?? 0) : 0;
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          uid: user.uid,
          displayName: data.displayName || user.displayName || "User",
          name: data.name || user.displayName || "User",
          email: data.email || user.email || "",
          photoURL: data.photoURL || user.photoURL || "",
          morningPerson: data.morningPerson ?? true,
          bedtime: data.bedtime || "22:00",
          wakeTime: data.wakeTime || "06:00",
          goals: data.goals || [],
          language: data.language || 'ID',
          notificationsEnabled: data.notificationsEnabled ?? true,
          screenTimeGoal: data.screenTimeGoal ?? 360,
          allowedDays: data.allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          allowedStartTime: data.allowedStartTime || "08:00",
          allowedEndTime: data.allowedEndTime || "22:00",
          streakTotal: activeStreak,
          completedTasks: activeCompleted,
          uncompletedTasks: activeUncompleted,
          screenTimeSeconds: activeScreenTimeSeconds,
          createdAt: data.createdAt || new Date(),
          stats: {
            streak: data.stats?.streak ?? activeStreak,
            completed: data.stats?.completed ?? activeCompleted,
            uncompleted: data.stats?.uncompleted ?? activeUncompleted
          }
        });
      }
    });

    const habitsQuery = query(collection(db, "users", user.uid, "habits"));
    const unsubHabits = onSnapshot(habitsQuery, (snap) => {
      const hData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Habit));
      setHabits(hData);
      setTargetsState(hData);
    });

    const scheduleQuery = query(collection(db, "users", user.uid, "schedules"));
    const unsubSchedule = onSnapshot(scheduleQuery, (snap) => {
      const sData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem));
      setSchedule(sData);
      setSchedulesState(sData);
    });

    return () => {
      unsubProfile();
      unsubHabits();
      unsubSchedule();
    };
  }, [user]);

  React.useEffect(() => {
    if (profile) {
      setStreakTotal(profile.streakTotal ?? 0);
      setCompletedTasks(profile.completedTasks ?? 0);
    } else {
      setStreakTotal(0);
      setCompletedTasks(0);
    }
  }, [profile]);

  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());
  React.useEffect(() => {
    localStorage.setItem('disiplin_manual_tasks', JSON.stringify(manualSchedule));
  }, [manualSchedule]);

  const combinedSchedule = React.useMemo(() => {
    const seen = new Set<string>();
    const all = [...schedule, ...manualSchedule];
    const unique: ScheduleItem[] = [];
    for (const item of all) {
      const finalId = item.id || crypto.randomUUID();
      if (!seen.has(finalId)) {
        seen.add(finalId);
        unique.push({ ...item, id: finalId });
      }
    }
    return unique;
  }, [schedule, manualSchedule]);

  // Seeding chronos_chart_data from existing completed items if missing
  React.useEffect(() => {
    try {
      const storedStr = localStorage.getItem('chronos_chart_data');
      if (!storedStr || storedStr === '[]') {
        const initialCompleted = combinedSchedule
          .filter(item => item.status === 'completed')
          .map(item => ({
            id: item.id,
            title: item.title,
            date: item.date || new Date().toISOString().split('T')[0],
            startTime: item.startTime || "12:00",
            category: item.category || "Personal"
          }));
        if (initialCompleted.length > 0) {
          localStorage.setItem('chronos_chart_data', JSON.stringify(initialCompleted));
          window.dispatchEvent(new Event('chronos_chart_updated'));
        }
      }
    } catch (err) {
      console.warn("localStorage chronos_chart_data seeding error:", err);
    }
  }, [combinedSchedule]);

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const finalUpdates = { ...updates };
    if (updates.stats) {
      if (typeof updates.stats.streak === 'number') {
        finalUpdates.streakTotal = updates.stats.streak;
      }
      if (typeof updates.stats.completed === 'number') {
        finalUpdates.completedTasks = updates.stats.completed;
      }
      if (typeof updates.stats.uncompleted === 'number') {
        finalUpdates.uncompletedTasks = updates.stats.uncompleted;
      }
    }
    await updateDoc(doc(db, "users", user.uid), finalUpdates);
    setProfile(p => p ? { ...p, ...finalUpdates } : null);
  };

  // Initialize and synchronize stats if they are missing
  React.useEffect(() => {
    if (!user || !profile || !schedule) return;
    
    if (!profile.stats || typeof profile.stats.completed !== 'number' || typeof profile.stats.uncompleted !== 'number' || typeof profile.stats.streak !== 'number') {
      const initialCompleted = [...schedule, ...manualSchedule].filter(item => item.status === 'completed').length;
      const initialUncompleted = [...schedule, ...manualSchedule].filter(item => item.status === 'pending' || item.status === 'missed').length;
      const initialStreak = profile.stats?.streak ?? 0; // Fixed from 12 to 0 for a clean new user zero-state
      
      handleUpdateProfile({
        stats: {
          completed: initialCompleted,
          uncompleted: initialUncompleted,
          streak: initialStreak
        }
      });
    }
  }, [user, profile, schedule, manualSchedule]);

  // Streak verification trigger on page load / day roll-over
  React.useEffect(() => {
    if (!user || !profile || !combinedSchedule.length) return;
    
    const todayString = new Date().toISOString().split('T')[0];
    const lastResetCheckDate = (profile.stats as any)?.lastResetCheckDate;
    
    // Check daily once
    if (lastResetCheckDate !== todayString) {
      const yesterdayObj = new Date();
      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
      const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

      const yesterdaysTasks = combinedSchedule.filter(item => item.date === yesterdayStr);
      const yesterdayIncomplete = yesterdaysTasks.length > 0 && yesterdaysTasks.some(t => t.status !== 'completed');

      if (yesterdayIncomplete) {
        // Reset streak because some tasks were left uncompleted yesterday
        handleUpdateProfile({
          stats: {
            ...profile.stats,
            streak: 0,
            completed: profile.stats?.completed ?? 0,
            uncompleted: profile.stats?.uncompleted ?? 0,
            lastResetCheckDate: todayString
          } as any
        });
      } else {
        // Just record that we checked today so we don't repeat the evaluation
        handleUpdateProfile({
          stats: {
            ...profile.stats,
            completed: profile.stats?.completed ?? 0,
            uncompleted: profile.stats?.uncompleted ?? 0,
            streak: profile.stats?.streak ?? 0,
            lastResetCheckDate: todayString
          } as any
        });
      }
    }
  }, [user, profile, combinedSchedule]);

  const checkAndIncrementStreak = async (currentCombinedSchedule: ScheduleItem[]) => {
    if (!profile) return;
    const todayString = new Date().toISOString().split('T')[0];
    
    // Check if 100% of today's tasks are completed
    const todaysTasks = currentCombinedSchedule.filter(item => item.date === todayString);
    const allCompletedToday = todaysTasks.length > 0 && todaysTasks.every(t => t.status === 'completed');
    const lastStreakDate = (profile.stats as any)?.lastStreakDate;

    if (allCompletedToday && lastStreakDate !== todayString) {
      const currentStreak = profile.stats?.streak ?? 0;
      await handleUpdateProfile({
        stats: {
          ...profile.stats,
          streak: currentStreak + 1,
          completed: profile.stats?.completed ?? 0,
          uncompleted: profile.stats?.uncompleted ?? 0,
          lastStreakDate: todayString
        } as any
      });
    }
  };

  const handleAddHabit = async (habit: Habit) => {
    if (!user) return;
    await addDoc(collection(db, "users", user.uid, "habits"), { ...habit, userId: user.uid });
  };

  const handleDeleteHabit = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "habits", id));
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    
    const taskToDelete = combinedSchedule.find(item => item.id === id);
    if (taskToDelete && profile && profile.stats) {
      // Deleting tasks should NOT decrement Total Selesai metric card value (Rule 3)
      // But we decrement uncompleted if the deleted task was uncompleted
      let newUncompleted = profile.stats.uncompleted;
      if (taskToDelete.status === 'pending' || taskToDelete.status === 'missed') {
        newUncompleted = Math.max(0, profile.stats.uncompleted - 1);
      }
      await handleUpdateProfile({
        stats: {
          ...profile.stats,
          uncompleted: newUncompleted
        }
      });
    }

    // ALWAYS filter BOTH local state caches immediately to reflect the deletion and avoid ghost states
    setSchedule(prev => prev.filter(item => item.id !== id));
    setManualSchedule(prev => prev.filter(item => item.id !== id));

    try {
      await deleteDoc(doc(db, "users", user.uid, "schedules", id));
    } catch (error: any) {
      console.warn("Document not found or delete failed on server:", error?.message || error);
    }
  };

  const getWeekDateStrings = (pivotDateStr: string): string[] => {
    const [year, month, day] = pivotDateStr.split('-').map(Number);
    const pivot = new Date(year, month - 1, day);
    const dayOfWeek = pivot.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(pivot);
    monday.setDate(pivot.getDate() + diffToMonday);
    
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${dayNum}`);
    }
    return dates;
  };

  const forceAbsoluteFactoryReset = async () => {
    setIsScheduleLoading(true);

    if (auth.currentUser) {
      try {
        const userId = auth.currentUser.uid;
        const { writeBatch, query, collection, getDocs, doc } = await import("firebase/firestore");

        const schedQuery = query(collection(db, "users", userId, "schedules"));
        const schedSnap = await getDocs(schedQuery);

        const habitsQuery = query(collection(db, "users", userId, "habits"));
        const habitsSnap = await getDocs(habitsQuery);

        const targetsQuery = query(collection(db, "users", userId, "targets"));
        const targetsSnap = await getDocs(targetsQuery);

        const historyQuery = query(collection(db, "users", userId, "history"));
        const historySnap = await getDocs(historyQuery);

        const batch = writeBatch(db);

        schedSnap.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        habitsSnap.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        targetsSnap.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        historySnap.docs.forEach((d) => {
          batch.delete(d.ref);
        });

        await batch.commit();

        const { setDoc, serverTimestamp } = await import("firebase/firestore");
        await setDoc(doc(db, "users", userId), {
          email: auth.currentUser.email || "",
          displayName: auth.currentUser.displayName || "User",
          streakTotal: 0,
          completedTasks: 0,
          uncompletedTasks: 0,
          screenTimeSeconds: 0,
          lastUpdated: serverTimestamp()
        }, { merge: false });
      } catch (error) {
        console.error("Failed cloud purge during factory reset:", error);
      }
    }

    setTargets([]);
    setSchedules([]);
    setStreak(0);
    setScreenTime(0);
    setHabits([]);
    setSchedule([]);
    setManualSchedule([]);

    try {
      localStorage.clear();
      sessionStorage.clear();
      window.dispatchEvent(new Event('chronos_screen_time_reset'));
    } catch (e) {
      console.warn("Storage wipe warn during factory reset:", e);
    }
    setIsScheduleLoading(false);
  };

  const resetDailySchedule = async () => {
    if (!user) return;
    setIsScheduleLoading(true);

    const targetDate = activeDayContext;
    
    setSchedule(prev => prev.filter(item => item.date !== targetDate));
    setManualSchedule(prev => prev.filter(item => item.date !== targetDate));

    try {
      const { writeBatch, query, collection, getDocs, where } = await import("firebase/firestore");
      const q = query(collection(db, "users", user.uid, "schedules"), where("date", "==", targetDate));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to delete daily schedules from cloud:", error);
    } finally {
      setTimeout(() => {
        setIsScheduleLoading(false);
        triggerRefresh();
      }, 500);
    }
  };

  const resetWeeklySchedule = async () => {
    if (!user) return;
    setIsScheduleLoading(true);

    const weekDates = getWeekDateStrings(activeDayContext);

    setSchedule(prev => prev.filter(item => !item.date || !weekDates.includes(item.date)));
    setManualSchedule(prev => prev.filter(item => !item.date || !weekDates.includes(item.date)));

    try {
      const { writeBatch, query, collection, getDocs } = await import("firebase/firestore");
      const q = query(collection(db, "users", user.uid, "schedules"));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      let deletedCount = 0;
      snap.docs.forEach((d) => {
        const itemDate = d.data().date;
        if (itemDate && weekDates.includes(itemDate)) {
          batch.delete(d.ref);
          deletedCount++;
        }
      });
      if (deletedCount > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Failed to delete weekly schedules from cloud:", error);
    } finally {
      setTimeout(() => {
        setIsScheduleLoading(false);
        triggerRefresh();
      }, 500);
    }
  };

  const resetMonthlySchedule = async () => {
    if (!user) return;
    setIsScheduleLoading(true);

    const targetMonthPrefix = activeDayContext.substring(0, 7); // "YYYY-MM"

    setSchedule(prev => prev.filter(item => !item.date || !item.date.startsWith(targetMonthPrefix)));
    setManualSchedule(prev => prev.filter(item => !item.date || !item.date.startsWith(targetMonthPrefix)));

    try {
      const { writeBatch, query, collection, getDocs } = await import("firebase/firestore");
      const q = query(collection(db, "users", user.uid, "schedules"));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      let deletedCount = 0;
      snap.docs.forEach((d) => {
        const itemDate = d.data().date;
        if (itemDate && itemDate.startsWith(targetMonthPrefix)) {
          batch.delete(d.ref);
          deletedCount++;
        }
      });
      if (deletedCount > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Failed to delete monthly schedules from cloud:", error);
    } finally {
      setTimeout(() => {
        setIsScheduleLoading(false);
        triggerRefresh();
      }, 500);
    }
  };

  const handleClearHistory = async () => {
    if (!user) return;
    
    // Clear Manual History
    setManualSchedule(prev => prev.filter(item => item.status !== 'completed'));

    // Clear Firebase History
    const completedFirebaseItems = schedule.filter(item => item.status === 'completed');
    for (const item of completedFirebaseItems) {
      if (item.id) {
        try {
          await deleteDoc(doc(db, "users", user.uid, "schedules", item.id));
        } catch (error) {
          console.error("Failed to delete firebase item:", error);
        }
      }
    }
    // Note: profile.stats.completed is NOT decremented upon clearing history (Rule 3)
  };

  const handleUpdateStatus = async (id: string, status: ScheduleItem['status']) => {
    if (!user) return;
    
    const oldItem = combinedSchedule.find(item => item.id === id);
    const oldStatus = oldItem ? oldItem.status : 'pending';

    // Append to chronos_chart_data permanently if status is completed
    if (status === 'completed' && oldItem) {
      try {
        const storedStr = localStorage.getItem('chronos_chart_data');
        const storedData = storedStr ? JSON.parse(storedStr) : [];
        if (Array.isArray(storedData) && !storedData.some((entry: any) => entry.id === id)) {
          const newEntry = {
            id: oldItem.id,
            title: oldItem.title,
            date: oldItem.date || new Date().toISOString().split('T')[0],
            startTime: oldItem.startTime || "12:00",
            category: oldItem.category || "Personal"
          };
          storedData.push(newEntry);
          localStorage.setItem('chronos_chart_data', JSON.stringify(storedData));
          window.dispatchEvent(new Event('chronos_chart_updated'));
        }
      } catch (err) {
        console.warn("localStorage chronos_chart_data update error:", err);
      }
    }

    // Remove from chronos_chart_data if changed back from completed (Undo)
    if (status !== 'completed' && oldStatus === 'completed') {
      try {
        const storedStr = localStorage.getItem('chronos_chart_data');
        if (storedStr) {
          const storedData = JSON.parse(storedStr);
          if (Array.isArray(storedData)) {
            const filtered = storedData.filter((entry: any) => entry.id !== id);
            localStorage.setItem('chronos_chart_data', JSON.stringify(filtered));
            window.dispatchEvent(new Event('chronos_chart_updated'));
          }
        }
      } catch (err) {
        console.warn("localStorage chronos_chart_data reverted error:", err);
      }
    }

    const isManualItem = manualSchedule.some(item => item.id === id);
    let updatedSchedule = combinedSchedule;

    const nextManual = manualSchedule.map(item => item.id === id ? { ...item, status } : item);
    const nextFirebase = schedule.map(item => item.id === id ? { ...item, status } : item);
    updatedSchedule = [...nextFirebase, ...nextManual];

    if (isManualItem) {
      setManualSchedule(nextManual);
    } else {
      setSchedule(nextFirebase);
    }

    // Option A: Use setDoc with { merge: true } to prevent "No document to update" error
    try {
      const docRef = doc(db, "users", user.uid, "schedules", id);
      const updatePayload = oldItem ? { ...oldItem, status } : { status };
      await setDoc(docRef, updatePayload, { merge: true });
    } catch (error: any) {
      console.error("Firebase update failed, checking if it exists in local state:", error);
    }

    // Evaluate stats shifts
    if (profile && oldStatus !== status && profile.stats) {
      const currentCompleted = profile.stats.completed ?? 0;
      const currentUncompleted = profile.stats.uncompleted ?? 0;
      let newCompleted = currentCompleted;
      let newUncompleted = currentUncompleted;

      if (oldStatus === 'completed') {
        newCompleted = Math.max(0, currentCompleted - 1);
      }
      if (status === 'completed') {
        newCompleted = currentCompleted + 1;
      }

      if (oldStatus === 'pending' || oldStatus === 'missed') {
        newUncompleted = Math.max(0, currentUncompleted - 1);
      }
      if (status === 'pending' || status === 'missed') {
        newUncompleted = currentUncompleted + 1;
      }

      await handleUpdateProfile({
        stats: {
          ...profile.stats,
          completed: newCompleted,
          uncompleted: newUncompleted
        }
      });
    }

    // Check streak logic with current updated schedule state
    setTimeout(() => {
      checkAndIncrementStreak(updatedSchedule);
    }, 100);
  };

  const filterAndEnforceScheduleConstraints = (items: any[], isBypassed = false) => {
    if (!profile) return items;
    const allowedDays = profile.allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const allowedStartTime = profile.allowedStartTime || "08:00";
    const allowedEndTime = profile.allowedEndTime || "22:00";

    const dayToAbbr = (dayName: string) => {
      if (!dayName) return "Mon";
      return dayName.slice(0, 3);
    };

    const parseMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    const formatMinutes = (totalMin: number) => {
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const startBound = parseMinutes(allowedStartTime);
    const endBound = parseMinutes(allowedEndTime);

    return items
      .filter(item => {
        if (isBypassed) return true; // Authorize bypass programmatically
        const abbr = dayToAbbr(item.day);
        return allowedDays.includes(abbr);
      })
      .map(item => {
        let taskStart = parseMinutes(item.startTime || "09:00");
        let taskEnd = parseMinutes(item.endTime || "10:00");
        let duration = taskEnd - taskStart;
        if (duration <= 0) duration = 60;

        if (taskStart < startBound) {
          taskStart = startBound;
          taskEnd = taskStart + duration;
        }

        if (taskEnd > endBound) {
          taskEnd = endBound;
          taskStart = Math.max(startBound, taskEnd - duration);
        }

        return {
          ...item,
          startTime: formatMinutes(taskStart),
          endTime: formatMinutes(taskEnd)
        };
      })
      .filter(item => {
        const taskStart = parseMinutes(item.startTime);
        const taskEnd = parseMinutes(item.endTime);
        return taskStart >= startBound && taskEnd <= endBound && taskStart < taskEnd;
      });
  };

  const handleAIRecommended = async (items: any[], scope: string, isBypassed = false) => {
    if (!user) return;
    
    // STRICTLY respect allowedDays & startTime/endTime selections upon triggering recommendations:
    const filteredItems = filterAndEnforceScheduleConstraints(items, isBypassed);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let existingItemsInContext = [];
    if (scope === 'daily') {
      existingItemsInContext = schedule.filter(item => item.date === today);
    } else {
      existingItemsInContext = schedule;
    }

    // Overwrite the IDs immediately at frontend level to ensure uniqueness
    const itemsWithNewIds = filteredItems.map(item => ({
      ...item,
      id: crypto.randomUUID()
    }));

    if (existingItemsInContext.length > 0) {
      setPendingItems(itemsWithNewIds);
      setPendingScope(scope);
      setIsOverwriteModalOpen(true);
    } else {
      setIsScheduleLoading(true);
      try {
        await saveRecommendedItems(itemsWithNewIds);
      } finally {
        setTimeout(() => {
          setIsScheduleLoading(false);
          triggerRefresh();
        }, 1500);
      }
    }
  };

  const saveRecommendedItems = async (items: any[]) => {
    if (!user) return;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const savedItems: ScheduleItem[] = [];

    for (const item of items) {
      const itemDate = item.date || new Date().toISOString().split('T')[0];
      const dateObj = new Date(itemDate);
      const dayName = dayNames[dateObj.getDay()];
      
      // Ensure ID is unique even if it was set before
      const finalTaskId = item.id || crypto.randomUUID();
      const finalItem = {
        ...item,
        id: finalTaskId, 
        userId: user.uid,
        status: 'pending' as const,
        date: itemDate,
        day: item.day || dayName,
        isManual: false
      };

      savedItems.push(finalItem);

      try {
        await setDoc(doc(db, "users", user.uid, "schedules", finalTaskId), finalItem);
      } catch (error) {
        console.warn("Failed to sync AI task to cloud, keeping in local memory context:", error);
      }
    }

    // Always manually set the local schedule state so the dashboard updates fully and robustly even if offline
    setSchedule(prev => {
      const kept = prev.filter(p => !savedItems.some(s => s.id === p.id));
      return [...kept, ...savedItems];
    });

    // Increment uncompleted count on profile stats for batch AI recommended items
    if (profile && profile.stats && items.length > 0) {
      await handleUpdateProfile({
        stats: {
          ...profile.stats,
          uncompleted: (profile.stats.uncompleted ?? 0) + items.length
        }
      });
    }
    setPendingItems([]);
    setIsOverwriteModalOpen(false);
  };

  const handleConfirmOverwrite = async () => {
    if (!user) return;
    
    // Close modal instantly and clear/load visible schedule container state
    setIsOverwriteModalOpen(false);
    setIsScheduleLoading(true);

    const today = new Date().toISOString().split('T')[0];
    
    // Clear Manual Items for the scope
    if (pendingScope === 'daily') {
      setManualSchedule(prev => prev.filter(item => item.date !== today));
    } else {
      setManualSchedule([]);
    }

    // Clear Firebase items
    const itemsToDelete = pendingScope === 'daily' 
      ? schedule.filter(item => item.date === today)
      : schedule;

    // Immediately update local state to avoid old items lingering
    setSchedule(prev => {
      const idsToDelete = new Set(itemsToDelete.map(x => x.id));
      return prev.filter(x => !idsToDelete.has(x.id));
    });

    for (const item of itemsToDelete) {
      if (item.id) {
        try {
          await deleteDoc(doc(db, "users", user.uid, "schedules", item.id));
        } catch (err) {
          console.warn("Failed to delete firebase item during overwrite:", err);
        }
      }
    }

    try {
      await saveRecommendedItems(pendingItems);
    } finally {
      setTimeout(() => {
        setIsScheduleLoading(false);
        triggerRefresh();
      }, 1500);
    }
  };

  const handleManualAddActivity = async (activity: { title: string, category: string, startTime: string, endTime: string, date?: string }) => {
    if (!user) return;
    const localToday = new Date().toLocaleDateString('en-CA');
    const saveDate = activity.date || activeDayContext || localToday;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Parse using local components to avoid UTC timezone offset shifts
    const [year, month, day] = saveDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = dayNames[dateObj.getDay()];
    const taskId = crypto.randomUUID();

    const newTask: ScheduleItem = {
      ...activity,
      id: taskId,
      userId: user.uid,
      status: 'pending',
      date: saveDate,
      day: dayName,
      isAIRecommended: false,
      isManual: true
    };

    setManualSchedule(prev => [...prev, newTask]);

    // Ensure the generated UUID taskId is properly mapped and synced to Firestore under schedules
    try {
      await setDoc(doc(db, "users", user.uid, "schedules", taskId), newTask);
    } catch (error) {
      console.warn("Failed to sync manual task to cloud:", error);
    }
    
    // Increment uncompleted stats on manual schedule addition
    if (profile && profile.stats) {
      await handleUpdateProfile({
        stats: {
          ...profile.stats,
          uncompleted: (profile.stats.uncompleted ?? 0) + 1
        }
      });
    }

    setIsAddActivityModalOpen(false);
    triggerRefresh();
  };

  if (isInitialAppMounting) {
    return (
      <div className={cn(
        "h-screen w-full flex flex-col items-center justify-center transition-colors duration-500",
        isDarkMode ? "bg-slate-900" : "bg-white"
      )}>
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className={cn(
            "font-poppins italic text-4xl sm:text-5xl font-black select-none tracking-tight transition-colors duration-500",
            isDarkMode ? "text-[#32cd32]" : "text-[#daa520]"
          )}>
            Disiplin.AI
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full border-2 animate-spin transition-colors duration-500",
              isDarkMode 
                ? "border-[#32cd32]/20 border-t-[#32cd32]" 
                : "border-[#daa520]/20 border-t-[#daa520]"
            )} />
            <span className={cn(
              "text-[10px] font-mono tracking-[0.2em] uppercase animate-pulse mt-1 transition-colors duration-500",
              isDarkMode ? "text-[#32cd32]/65" : "text-[#daa520]/65"
            )}>
              Memuat Sistem...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return (
    <div className="min-h-screen bg-theme-bg flex flex-col items-center justify-center p-4 theme-transition">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-12 bg-theme-card p-12 rounded-[3.5rem] border border-theme-border shadow-2xl theme-transition"
      >
        <div className="w-24 h-24 bg-theme-accent rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl relative group theme-transition animate-pulse-slow">
          <LayoutDashboard className="text-theme-text-on-accent group-hover:rotate-12 transition-transform duration-300" size={40} />
          <div className="absolute inset-0 bg-theme-accent/20 blur-2xl -z-10 group-hover:opacity-40 transition-opacity" />
        </div>
        <div className="space-y-4">
          <h1 className="text-6xl font-sans font-black tracking-tighter text-theme-text-primary uppercase italic">Disiplin.</h1>
          <p className="text-theme-text-secondary font-serif font-medium max-w-xs mx-auto leading-relaxed">Unlock your potential through AI-powered discipline and structured daily performance.</p>
        </div>
        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-theme-accent hover:bg-theme-accent-hover text-theme-text-on-accent font-sans font-black py-5 rounded-[2rem] transition-all shadow-2xl shadow-theme-accent/15 active:scale-[0.98] cursor-pointer"
        >
          <LogIn size={22} /> Get Started Free
        </button>
      </motion.div>
    </div>
  );

  const lang = profile?.language || 'ID';
  const t = translations[lang];

  const getDisciplineBadge = () => {
    const totalSelesai = profile?.stats?.completed ?? 0;
    const belumSelesai = profile?.stats?.uncompleted ?? 0;
    const total = totalSelesai + belumSelesai;
    const rate = total > 0 ? (totalSelesai / total) * 100 : 0;
    const streak = profile?.stats?.streak ?? 0;

    if (rate >= 90 && streak >= 7) {
      return {
        text: lang === 'ID' ? "Top 1% Disiplin" : "Top 1% Disciplined",
        className: "bg-amber-500 border-amber-600 text-white"
      };
    } else if (rate >= 70 && rate <= 89) {
      return {
        text: lang === 'ID' ? "Konsisten Tinggi" : "Consistent Performer",
        className: "bg-emerald-600 border-emerald-700 text-white"
      };
    } else {
      return {
        text: lang === 'ID' ? "Disiplin Tumbuh" : "Rising Discipline",
        className: "bg-purple-600 border-purple-700 text-white"
      };
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary flex flex-col md:flex-row font-sans selection:bg-theme-accent-light-bg selection:text-theme-text-primary theme-transition">
      <AnimatePresence>
        {isSplashActive && (
          <motion.div
            key="splash-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className={cn(
              "fixed inset-0 z-[10000] flex flex-col items-center justify-center transition-colors duration-500",
              isDarkMode ? "bg-slate-900" : "bg-white"
            )}
          >
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className={cn(
                "font-poppins italic text-4xl sm:text-5xl font-black select-none tracking-tight transition-colors duration-500",
                isDarkMode ? "text-[#32cd32]" : "text-[#daa520]"
              )}>
                Disiplin.AI
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full border-2 animate-spin transition-colors duration-500",
                  isDarkMode 
                    ? "border-[#32cd32]/20 border-t-[#32cd32]" 
                    : "border-[#daa520]/20 border-t-[#daa520]"
                )} />
                <span className={cn(
                  "text-[10px] font-mono tracking-[0.2em] uppercase animate-pulse mt-1 transition-colors duration-500",
                  isDarkMode ? "text-[#32cd32]/65" : "text-[#daa520]/65"
                )}>
                  Memuat Sistem...
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar Navigation */}
      <aside className={cn(
        "w-full md:w-24 border-b md:border-b-0 md:border-r border-theme-border flex md:flex-col items-center justify-between md:justify-start py-2.5 md:py-10 px-5 md:px-0 gap-4 md:gap-10 sticky top-0 bg-theme-card/85 backdrop-blur-md md:backdrop-blur-3xl z-50 transition-all duration-300 ease-in-out font-sans",
        scrollDirection === 'down' ? 'translate-y-[-100%] md:translate-y-0' : 'translate-y-0'
      )}>
        <div className="w-9 h-9 md:w-12 md:h-12 bg-theme-accent rounded-xl md:rounded-2xl flex items-center justify-center text-theme-text-on-accent font-sans font-black text-lg md:text-2xl shadow-xl shadow-theme-accent/15 animate-spin-slow">D</div>
        <nav className="flex md:flex-col gap-2 md:gap-10">
          {[
            { id: 'dashboard' as View, icon: Home },
            { id: 'stats' as View, icon: BarChart2 },
            { id: 'settings' as View, icon: Settings },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "p-2.5 md:p-5 pb-2.5 md:pb-5 rounded-xl md:rounded-2xl transition-all duration-300 ease-in-out relative group/nav theme-transition cursor-pointer flex flex-col items-center justify-center",
                currentView === item.id 
                  ? "text-theme-accent bg-theme-accent-light-bg shadow-xl shadow-theme-accent/5 ring-1 ring-theme-border" 
                  : "text-theme-text-secondary hover:text-theme-accent"
              )}
            >
              <item.icon className="w-5.5 h-5.5 md:w-6.5 md:h-6.5 transition-all duration-300 ease-in-out group-hover/nav:scale-110 relative z-10" />
              {/* Dynamic hover sliding backgrounds using transparent bg overlay */}
              <span className="absolute inset-x-1.5 inset-y-1.5 bg-theme-accent/5 opacity-0 scale-90 group-hover/nav:opacity-100 group-hover/nav:scale-100 rounded-lg md:rounded-xl transition-all duration-300 ease-in-out -z-10" />
              {currentView === item.id && (
                <>
                  {/* Top-header horizontal underline for mobile views */}
                  <motion.div 
                    layoutId="mainNavUnderline" 
                    className="absolute bottom-1 left-2.5 right-2.5 h-0.5 bg-theme-accent rounded-full z-10 md:hidden" 
                    transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                  />
                  {/* Vertical vertical-sidebar slide accent line for desktop views */}
                  <motion.div 
                    layoutId="mainNavVerticalBar" 
                    className="hidden md:block absolute left-0 top-3 bottom-3 w-1 bg-theme-accent rounded-r-full z-10" 
                    transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                  />
                </>
              )}
              <span className="sr-only">{t[item.id as keyof typeof t]}</span>
            </button>
          ))}
        </nav>
        <div className="hidden md:block mt-auto pb-4">
           <button onClick={() => auth.signOut()} className="p-4 text-theme-text-secondary hover:text-red-500 transition-all cursor-pointer"><LogOut size={26} /></button>
        </div>
      </aside>

      {/* Main Container */}
      <div 
        onScroll={handleScroll}
        className="flex-1 overflow-x-hidden relative h-screen custom-scrollbar overflow-y-auto smooth-scroll bg-theme-bg theme-transition"
      >
        <main className="max-w-[1400px] mx-auto p-6 md:p-12 lg:p-16 pb-32">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 xl:grid-cols-12 gap-12"
              >
                <div className="xl:col-span-8 space-y-1 sm:space-y-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2 sm:gap-4 mb-1">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-mono uppercase tracking-[0.5em] font-black text-theme-text-secondary mb-1 opacity-60">{t.workspace}</h4>
                        <h1 className="text-3xl sm:text-4xl md:text-6xl font-sans font-black tracking-tight text-theme-text-primary italic leading-none">{t.dashboard}</h1>
                      </div>
                   </div>
                   <Calendar 
                     items={combinedSchedule} 
                     onToggleStatus={handleUpdateStatus} 
                     onAddActivityClick={() => setIsAddActivityModalOpen(true)}
                     lang={lang} 
                     view={calendarView}
                     onViewChange={setCalendarView}
                     onActiveDayChange={setActiveDayContext}
                     isLoading={isScheduleLoading}
                     onResetDaily={resetDailySchedule}
                     onResetWeekly={resetWeeklySchedule}
                     onResetMonthly={resetMonthlySchedule}
                   />
                </div>

                <div className="xl:col-span-4 space-y-12">
                   <div className="bg-theme-card p-8 md:p-10 rounded-[3rem] border border-theme-border shadow-sm min-h-[400px] flex flex-col theme-transition">
                      <HabitManager habits={habits} onAddHabit={handleAddHabit} onDeleteHabit={handleDeleteHabit} lang={lang} />
                   </div>
                   <div className="h-[600px] md:h-[700px]">
                      <AISidebar 
                        lang={lang}
                        onRecommended={handleAIRecommended}
                        onUpdateProfile={handleUpdateProfile}
                        context={{
                          habits,
                          currentSchedule: combinedSchedule,
                          goals: profile?.goals || [],
                          morningPerson: profile?.morningPerson ?? true,
                          view: calendarView,
                          activeDayContext,
                          allowedDays: profile?.allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                          allowedStartTime: profile?.allowedStartTime || "08:00",
                          allowedEndTime: profile?.allowedEndTime || "22:00"
                        }} 
                      />
                   </div>
                </div>
              </motion.div>
            )}

            {currentView === 'stats' && (
              <motion.div 
                key="stats"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-12"
              >
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-8 bg-theme-card p-10 rounded-[3.5rem] border border-theme-border shadow-sm group theme-transition">
                    <div className="flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
                       <div className="w-32 h-32 rounded-[2.5rem] border-8 border-theme-bg overflow-hidden bg-theme-bg transform group-hover:scale-105 transition-transform duration-500 theme-transition">
                          {(auth.currentUser ? (auth.currentUser.photoURL || profile?.photoURL) : null) ? <img src={auth.currentUser?.photoURL || profile?.photoURL || ""} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <UserIcon size={50} className="text-theme-text-muted m-auto mt-7" />}
                       </div>
                       <div className="space-y-1">
                          <h2 className="text-4xl font-sans font-black text-theme-text-primary">{auth.currentUser ? (auth.currentUser.displayName || profile?.name || "Yovvv") : ""}</h2>
                          <p className="text-theme-text-secondary font-sans text-sm font-semibold tracking-wide">{auth.currentUser ? auth.currentUser.email : ""}</p>
                          <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                             <div className="px-3 py-1 rounded-full bg-theme-accent text-theme-text-on-accent text-[8px] font-sans font-black uppercase tracking-widest">{t.stats} Level</div>
                             {(() => {
                               const badge = getDisciplineBadge();
                               return (
                                 <div className={cn("px-3 py-1 rounded-full text-[8px] font-sans font-black uppercase tracking-widest border", badge.className)}>
                                   {badge.text}
                                 </div>
                               );
                             })()}
                          </div>
                       </div>
                    </div>
                 </div>
                 <DashboardStats schedule={combinedSchedule} lang={lang} profile={profile} />
              </motion.div>
            )}

            {currentView === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto"
              >
                 <SettingsPanel 
                   profile={profile!} 
                   schedule={combinedSchedule}
                   onUpdate={handleUpdateProfile} 
                   onToggleStatus={handleUpdateStatus}
                   onDeleteTask={handleDeleteTask}
                   onClearHistory={handleClearHistory}
                   lang={lang} 
                   isDarkMode={isDarkMode}
                   onToggleDarkMode={toggleDarkMode}
                 />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Overwrite Alert Modal */}
      <AnimatePresence>
        {isOverwriteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsOverwriteModalOpen(false)}
              className="absolute inset-0 bg-neutral-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-theme-card border border-theme-border rounded-[3rem] p-10 shadow-2xl relative overflow-hidden theme-transition"
            >
              <div className="space-y-6 text-center">
                <div className="w-20 h-20 bg-theme-accent-light-bg rounded-[1.5rem] flex items-center justify-center mx-auto">
                  <Sparkles className="text-theme-accent" size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-sans font-black text-theme-text-primary">{t.overwriteTitle}</h3>
                  <p className="text-theme-text-secondary font-serif text-sm leading-relaxed font-medium">{t.overwriteDesc}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleConfirmOverwrite}
                    className="w-full py-4 bg-theme-accent hover:bg-theme-accent-hover text-theme-text-on-accent rounded-2xl font-sans font-black uppercase tracking-widest transition-all shadow-xl shadow-theme-accent/15 cursor-pointer"
                  >
                    {t.overwriteBtn}
                  </button>
                  <button 
                    onClick={() => setIsOverwriteModalOpen(false)}
                    className="w-full py-4 bg-theme-bg hover:bg-theme-accent-light-bg text-theme-text-secondary hover:text-theme-accent rounded-2xl font-sans font-black uppercase tracking-widest transition-all cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Activity Manual Modal */}
      <AnimatePresence>
        {isAddActivityModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
             <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsAddActivityModalOpen(false)}
              className="absolute inset-0 bg-neutral-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-theme-card border border-theme-border rounded-[3rem] p-12 shadow-2xl relative overflow-hidden theme-transition"
            >
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleManualAddActivity({
                    title: formData.get('title') as string,
                    category: formData.get('category') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    date: formData.get('date') as string,
                  });
                }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <h3 className="text-2xl sm:text-3xl font-sans font-black text-theme-text-primary leading-tight">{t.addActivity}</h3>
                  <p className="text-theme-text-secondary text-[10px] font-mono uppercase tracking-[0.2em] opacity-60">MANUAL CREATION</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-black uppercase tracking-widest text-theme-text-secondary ml-1 opacity-60">Date</label>
                    <input required name="date" type="date" defaultValue={activeDayContext} className="w-full bg-theme-bg border border-theme-border text-theme-text-primary text-base rounded-2xl py-3 px-4 focus:ring-2 focus:ring-theme-accent outline-none transition-all theme-transition" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-black uppercase tracking-widest text-theme-text-secondary ml-1 opacity-60">{t.activityName}</label>
                    <input required name="title" type="text" className="w-full bg-theme-bg border border-theme-border text-theme-text-primary text-base rounded-2xl py-3 px-4 focus:ring-2 focus:ring-theme-accent outline-none transition-all theme-transition" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-black uppercase tracking-widest text-theme-text-secondary ml-1 opacity-60">{t.category}</label>
                    <select name="category" className="w-full bg-theme-bg border border-theme-border text-theme-text-primary text-base rounded-2xl py-3 px-4 focus:ring-2 focus:ring-theme-accent outline-none transition-all appearance-none theme-transition">
                      <option value="Hobi" className="bg-theme-card">{t.hobby}</option>
                      <option value="Kerja" className="bg-theme-card">{t.work}</option>
                      <option value="Belajar" className="bg-theme-card">{t.study}</option>
                      <option value="Hiburan" className="bg-theme-card">{t.entertainment}</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-black uppercase tracking-widest text-theme-text-secondary ml-1 opacity-60">{t.timeStart}</label>
                      <input required name="startTime" type="time" className="w-full bg-theme-bg border border-theme-border text-theme-text-primary text-base rounded-2xl py-3 px-4 focus:ring-2 focus:ring-theme-accent outline-none transition-all theme-transition" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-black uppercase tracking-widest text-theme-text-secondary ml-1 opacity-60">{t.timeEnd}</label>
                      <input required name="endTime" type="time" className="w-full bg-theme-bg border border-theme-border text-theme-text-primary text-base rounded-2xl py-3 px-4 focus:ring-2 focus:ring-theme-accent outline-none transition-all theme-transition" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setIsAddActivityModalOpen(false)} className="flex-1 py-3.5 bg-theme-bg hover:bg-theme-accent-light-bg text-theme-text-secondary hover:text-theme-accent rounded-2xl font-sans font-black uppercase tracking-widest transition-all cursor-pointer">{t.cancel}</button>
                  <button type="submit" className="flex-[2] py-3.5 bg-theme-accent hover:bg-theme-accent-hover text-theme-text-on-accent rounded-2xl font-sans font-black uppercase tracking-widest transition-all shadow-xl shadow-theme-accent/15 cursor-pointer">{t.save}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart Scroll-Driven Sticky Mobile Footer */}
      <div className={cn(
        "block lg:hidden fixed bottom-0 left-0 right-0 z-50 p-4 transform transition-all duration-305 ease-in-out",
        scrollDirection === 'down' 
          ? "translate-y-0 opacity-100" 
          : "translate-y-full opacity-0 pointer-events-none"
      )}>
        <div className="bg-theme-bg border border-theme-border rounded-[2rem] p-3 flex items-center justify-around gap-3 shadow-2xl max-w-md mx-auto theme-transition">
          <button 
            onClick={() => setActiveMobileDrawer('habits')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-theme-card border border-theme-border text-xs font-sans font-black uppercase tracking-wider text-theme-text-primary hover:text-theme-accent theme-transition cursor-pointer"
          >
            <Target size={16} className="text-theme-accent" />
            <span>{lang === 'ID' ? 'Target' : 'Targets'}</span>
          </button>
          
          <button 
            onClick={() => setActiveMobileDrawer('ai')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-theme-accent text-theme-text-on-accent text-xs font-sans font-black uppercase tracking-wider hover:bg-theme-accent-hover transition-all duration-300 shadow-lg shadow-theme-accent/20 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 shrink-0" />
            <span>{lang === 'ID' ? 'Prompt AI' : 'AI Prompt'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer/Modal Overlays */}
      <AnimatePresence>
        {activeMobileDrawer && (
          <div className="fixed inset-0 z-[160] flex items-end justify-center p-0 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setActiveMobileDrawer(null)}
              className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-lg bg-theme-card border-t md:border border-theme-border rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 pb-12 md:pb-8 shadow-2xl relative block overflow-hidden theme-transition max-h-[85vh] flex flex-col z-10"
            >
              <div className="w-12 h-1 bg-theme-border rounded-full mx-auto mb-6 shrink-0" />
              <div className="flex-1 overflow-y-auto pr-1">
                {activeMobileDrawer === 'habits' ? (
                  <div className="bg-theme-card p-4 rounded-2xl">
                    <HabitManager habits={habits} onAddHabit={handleAddHabit} onDeleteHabit={handleDeleteHabit} lang={lang} />
                  </div>
                ) : (
                  <div className="h-[550px]">
                    <AISidebar 
                      lang={lang}
                      onRecommended={handleAIRecommended}
                      onUpdateProfile={handleUpdateProfile}
                      context={{
                        habits,
                        currentSchedule: combinedSchedule,
                        goals: profile?.goals || [],
                        morningPerson: profile?.morningPerson ?? true,
                        view: calendarView,
                        activeDayContext,
                        allowedDays: profile?.allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                        allowedStartTime: profile?.allowedStartTime || "08:00",
                        allowedEndTime: profile?.allowedEndTime || "22:00"
                      }} 
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => setActiveMobileDrawer(null)}
                className="mt-6 w-full py-3.5 bg-theme-bg text-theme-text-secondary font-sans font-black text-xs uppercase tracking-widest rounded-xl hover:bg-theme-accent-light-bg transition-all text-center cursor-pointer border border-theme-border"
              >
                {lang === 'ID' ? 'Tutup' : 'Close'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Screen noise effect */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[9999] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />
    </div>
  );
}

