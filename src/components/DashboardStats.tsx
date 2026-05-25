import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ScheduleItem, UserProfile } from '../types';
import { TrendingUp, CheckCircle, XCircle, Zap, Fan } from 'lucide-react';
import { translations } from '../lib/translations';
import { cn } from '../lib/utils';
import { useScreenTime } from '../context/ScreenTimeContext';

interface DashboardStatsProps {
  schedule: ScheduleItem[];
  lang: 'ID' | 'EN';
  profile?: UserProfile | null;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ schedule, lang, profile }) => {
  const t = translations[lang];
  const [activeFilter, setActiveFilter] = React.useState<'D' | 'W' | 'M' | 'Y'>('W');
  const [chartSource, setChartSource] = React.useState<any[]>([]);

  const {
    activeSeconds,
    screenTimeLimit,
    setScreenTimeLimit,
    formattedActiveTime,
    formattedLimitTime,
    percentage,
    strokeOffset,
  } = useScreenTime();

  // Keep screenTimeLimit synchronized with profile in case it updates
  React.useEffect(() => {
    if (profile?.screenTimeGoal) {
      setScreenTimeLimit(profile.screenTimeGoal);
    }
  }, [profile?.screenTimeGoal, setScreenTimeLimit]);

  // Rule 3: Persistence for metrics
  const completedCount = profile?.stats?.completed !== undefined 
    ? profile.stats.completed 
    : schedule.filter(s => s.status === 'completed').length;

  // Rule 1: Dynamic "Belum Selesai" (Incomplete Tasks) calculation based on today's active schedule
  const todayString = React.useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const uncompletedCount = React.useMemo(() => {
    const todayTasks = schedule.filter(s => s.date === todayString);
    const totalActiveTasksToday = todayTasks.length;
    const tasksMarkedAsCompleteToday = todayTasks.filter(s => s.status === 'completed').length;
    return Math.max(0, totalActiveTasksToday - tasksMarkedAsCompleteToday);
  }, [schedule, todayString]);

  const streak = profile?.stats?.streak !== undefined 
    ? profile.stats.streak 
    : 0; // Fixed from 12 to 0 for a clean new user zero-state

  // Decouple Chart Data from Deletable History State by loading from permanent localStorage
  React.useEffect(() => {
    const loadChartData = () => {
      try {
        const storedStr = localStorage.getItem('chronos_chart_data');
        if (storedStr) {
          setChartSource(JSON.parse(storedStr));
        } else {
          setChartSource(schedule.filter(s => s.status === 'completed'));
        }
      } catch (err) {
        setChartSource(schedule.filter(s => s.status === 'completed'));
      }
    };

    loadChartData();

    window.addEventListener('chronos_chart_updated', loadChartData);
    return () => {
      window.removeEventListener('chronos_chart_updated', loadChartData);
    };
  }, [schedule]);

  // Rule 4: Dynamic calculations for the area charts based on the active filter
  const chartData = React.useMemo(() => {
    if (activeFilter === 'D') {
      // breakdown of completed tasks per hour slots today
      const todayCompleted = chartSource.filter(item => item.date === todayString);
      
      const slots = [
        { name: '06:00 - 09:00', value: 0 },
        { name: '09:00 - 12:00', value: 0 },
        { name: '12:00 - 15:00', value: 0 },
        { name: '15:00 - 18:00', value: 0 },
        { name: '18:00 - 21:00', value: 0 },
        { name: '21:00 - 06:00', value: 0 },
      ];

      todayCompleted.forEach(item => {
        if (!item.startTime) return;
        const hr = parseInt(item.startTime.split(':')[0], 10);
        if (isNaN(hr)) return;

        if (hr >= 6 && hr < 9) slots[0].value += 1;
        else if (hr >= 9 && hr < 12) slots[1].value += 1;
        else if (hr >= 12 && hr < 15) slots[2].value += 1;
        else if (hr >= 15 && hr < 18) slots[3].value += 1;
        else if (hr >= 18 && hr < 21) slots[4].value += 1;
        else slots[5].value += 1;
      });
      return slots;
    }

    if (activeFilter === 'W') {
      // Map across 7 days of current week (Mon-Sun)
      const current = new Date();
      const currentDay = current.getDay();
      const dayIndex = currentDay === 0 ? 7 : currentDay;
      const monday = new Date(current);
      monday.setDate(current.getDate() - dayIndex + 1);

      const daysOfWeek = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d.toISOString().split('T')[0];
      });

      const idNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const enNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const names = lang === 'ID' ? idNames : enNames;

      return names.map((name, i) => {
        const dateStr = daysOfWeek[i];
        const count = chartSource.filter(item => item.date === dateStr).length;
        return { name, value: count };
      });
    }

    if (activeFilter === 'M') {
      // last 4 weeks of the current month
      const current = new Date();
      const yr = current.getFullYear();
      const mo = current.getMonth();

      const wk1 = chartSource.filter(item => {
        if (!item.date) return false;
        const d = new Date(item.date);
        return d.getFullYear() === yr && d.getMonth() === mo && d.getDate() >= 1 && d.getDate() <= 7;
      }).length;

      const wk2 = chartSource.filter(item => {
        if (!item.date) return false;
        const d = new Date(item.date);
        return d.getFullYear() === yr && d.getMonth() === mo && d.getDate() >= 8 && d.getDate() <= 14;
      }).length;

      const wk3 = chartSource.filter(item => {
        if (!item.date) return false;
        const d = new Date(item.date);
        return d.getFullYear() === yr && d.getMonth() === mo && d.getDate() >= 15 && d.getDate() <= 21;
      }).length;

      const wk4 = chartSource.filter(item => {
        if (!item.date) return false;
        const d = new Date(item.date);
        return d.getFullYear() === yr && d.getMonth() === mo && d.getDate() >= 22;
      }).length;

      return [
        { name: lang === 'ID' ? 'Wk 1' : 'Week 1', value: wk1 },
        { name: lang === 'ID' ? 'Wk 2' : 'Week 2', value: wk2 },
        { name: lang === 'ID' ? 'Wk 3' : 'Week 3', value: wk3 },
        { name: lang === 'ID' ? 'Wk 4' : 'Week 4', value: wk4 },
      ];
    }

    // 'Y' (Year) - 12 calendar months
    const yr = new Date().getFullYear();
    const idMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = lang === 'ID' ? idMonths : enMonths;

    return monthNames.map((name, idx) => {
      const count = chartSource.filter(item => {
        if (!item.date) return false;
        const d = new Date(item.date);
        return d.getFullYear() === yr && d.getMonth() === idx;
      }).length;
      return { name, value: count };
    });
  }, [chartSource, activeFilter, lang, todayString]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-theme-card p-6 rounded-3xl border border-theme-border shadow-sm flex items-center gap-4 theme-transition">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-950/20 text-orange-500 rounded-2xl flex items-center justify-center shrink-0 theme-transition">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-xs text-theme-text-secondary font-medium">{t.streak}</p>
            <p className="text-2xl font-sans font-black text-theme-text-primary">{streak} <span className="text-sm font-normal text-theme-text-muted">{lang === 'ID' ? 'Hari' : 'Days'}</span></p>
          </div>
        </div>

        <div className="bg-theme-card p-6 rounded-3xl border border-theme-border shadow-sm flex items-center gap-4 theme-transition">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-950/20 text-green-500 rounded-2xl flex items-center justify-center shrink-0 theme-transition">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-theme-text-secondary font-medium">{t.completed}</p>
            <p className="text-2xl font-sans font-black text-theme-text-primary">{completedCount}</p>
          </div>
        </div>

        <div className="bg-theme-card p-6 rounded-3xl border border-theme-border shadow-sm flex items-center gap-4 theme-transition">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center shrink-0 theme-transition">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-theme-text-secondary font-medium">{t.uncompleted}</p>
            <p className="text-2xl font-sans font-black text-theme-text-primary">{uncompletedCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-theme-card p-8 rounded-3xl border border-theme-border shadow-sm space-y-6 theme-transition">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-theme-text-primary" />
            <h3 className="font-sans font-black text-theme-text-primary">{t.activity}</h3>
          </div>
          <div className="flex gap-2">
            {['D', 'W', 'M', 'Y'].map(f => (
              <button 
                key={f} 
                onClick={() => setActiveFilter(f as any)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-sans font-black transition-all cursor-pointer border",
                  activeFilter === f 
                    ? "bg-theme-accent text-theme-text-on-accent border-theme-accent"
                    : "bg-theme-bg text-theme-text-secondary border-theme-border hover:bg-theme-accent-light-bg hover:text-theme-accent"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-theme-accent-raw)" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="var(--color-theme-accent-raw)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-theme-border-raw)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--color-theme-text-secondary-raw)'}} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: '1px solid var(--color-theme-border-raw)', backgroundColor: 'var(--color-theme-card-raw)', color: 'var(--color-theme-text-primary-raw)' }}
              />
              <Area type="monotone" dataKey="value" stroke="var(--color-theme-accent-raw)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Screen Time Section */}
      <div className="bg-theme-sidebar-bg text-theme-text-primary p-6 rounded-3xl shadow-xl flex items-center justify-between overflow-hidden relative border border-theme-border theme-transition">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2 text-theme-accent">
               <Fan size={16} className="animate-spin-slow" />
               <span className="text-[10px] font-sans uppercase tracking-[0.2em] font-black">{t.screenTime}</span>
            </div>
            <p className="text-3xl font-sans font-black text-theme-text-primary">{formattedActiveTime(lang)}</p>
            <p className="text-xs text-theme-text-muted font-bold tracking-wider uppercase">Limit: {formattedLimitTime(lang)}</p>
          </div>
          <div className="relative z-10 w-24 h-24">
             <svg className="w-full h-full -rotate-90">
                <circle cx="45" cy="45" r="35" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-theme-border" />
                <circle cx="45" cy="45" r="35" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray="220" strokeDashoffset={strokeOffset} className="text-theme-accent transition-all duration-500 ease-out" strokeLinecap="round" />
             </svg>
          </div>
          <div className="absolute top-0 right-0 w-48 h-48 bg-theme-accent/10 blur-[80px] -mr-20 -mt-20 pointer-events-none" />
      </div>
    </div>
  );
};
