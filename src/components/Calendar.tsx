import React from "react";
import { ScheduleItem } from "../types";
import { cn } from "../lib/utils";
import { CheckCircle2, Circle, Sparkles, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { translations } from "../lib/translations";
import { motion, AnimatePresence } from "motion/react";

interface CalendarProps {
  items: ScheduleItem[];
  onToggleStatus: (id: string, status: ScheduleItem['status']) => void;
  onAddActivityClick: () => void;
  onActiveDayChange?: (date: string) => void;
  lang: 'ID' | 'EN';
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  isLoading?: boolean;
  onResetDaily?: () => void;
  onResetWeekly?: () => void;
  onResetMonthly?: () => void;
}

type ViewType = 'daily' | 'weekly' | 'monthly';

export const Calendar: React.FC<CalendarProps> = ({ 
  items, 
  onToggleStatus, 
  onAddActivityClick, 
  onActiveDayChange, 
  lang, 
  view, 
  onViewChange, 
  isLoading = false,
  onResetDaily,
  onResetWeekly,
  onResetMonthly
}) => {
  const t = translations[lang];
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({});

  const toggleSection = (id: string, date?: string) => {
    const isOpening = !expandedSections[id];
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    if (isOpening && date && onActiveDayChange) {
      onActiveDayChange(date);
    }
  };

  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const timeA = a.startTime || "";
      const timeB = b.startTime || "";
      return timeA.localeCompare(timeB);
    });
  }, [items]);

  // Filter items based on selected view without hiding completed tasks using robust local en-CA (YYYY-MM-DD) comparison
  const filteredActiveItems = React.useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    
    return sortedItems.filter(item => {
      if (view === 'daily') {
        const itemDateStr = item.date || todayStr;
        return itemDateStr === todayStr;
      }
      return true; 
    });
  }, [sortedItems, view]);

  const currentQuote = React.useMemo(() => {
    const hasPending = filteredActiveItems.some(item => item.status !== 'completed');
    return !hasPending ? t.disciplineQuote : '';
  }, [filteredActiveItems, t.disciplineQuote]);

  // Grouping logic for weekly and monthly
  const groupedItems = React.useMemo(() => {
    if (view === 'daily') return null;

    if (view === 'weekly') {
      const groups: Record<string, { items: ScheduleItem[], date: string }> = {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      filteredActiveItems.forEach(item => {
        let dateObj: Date;
        if (item.date) {
          const [year, month, day] = item.date.split('-').map(Number);
          dateObj = new Date(year, month - 1, day);
        } else {
          dateObj = new Date();
        }
        const dayLabel = t[dayNames[dateObj.getDay()] as keyof typeof t] || dayNames[dateObj.getDay()];
        if (!groups[dayLabel]) groups[dayLabel] = { items: [], date: item.date || new Date().toISOString().split('T')[0] };
        groups[dayLabel].items.push(item);
      });
      return groups;
    }

    if (view === 'monthly') {
      const groups: Record<string, Record<string, { items: ScheduleItem[], date: string }>> = {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      filteredActiveItems.forEach(item => {
        let dateObj: Date;
        if (item.date) {
          const [year, month, day] = item.date.split('-').map(Number);
          dateObj = new Date(year, month - 1, day);
        } else {
          dateObj = new Date();
        }
        const weekNum = Math.ceil(dateObj.getDate() / 7);
        const weekLabel = `${t.week} ${weekNum}`;
        const dayLabel = t[dayNames[dateObj.getDay()] as keyof typeof t] || dayNames[dateObj.getDay()];

        if (!groups[weekLabel]) groups[weekLabel] = {};
        if (!groups[weekLabel][dayLabel]) groups[weekLabel][dayLabel] = { items: [], date: item.date || new Date().toISOString().split('T')[0] };
        groups[weekLabel][dayLabel].items.push(item);
      });
      return groups;
    }
    return null;
  }, [filteredActiveItems, view, t]);

  const renderItem = (item: ScheduleItem, idx: number) => (
    <div className="relative group">
      {/* The Dot */}
      <div className={cn(
        "absolute -left-[54px] top-6 w-6 h-6 rounded-full border-4 border-theme-bg shadow-md transition-all duration-300 scale-100 group-hover:scale-125 z-10 theme-transition",
        item.status === 'completed' ? "bg-theme-accent" : "bg-theme-border"
      )} />

      <div 
        tabIndex={0}
        className={cn(
         "flex flex-row items-center justify-between w-full bg-theme-card p-5 pb-6 pl-10 sm:p-8 sm:pb-8 sm:pl-14 rounded-[2rem] sm:rounded-[2.5rem] border border-theme-border shadow-sm transition-all duration-300 hover:shadow-2xl hover:border-theme-border hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/40 relative overflow-hidden group/card theme-transition cursor-default h-auto min-h-[110px] sm:min-h-[130px]",
         item.status === 'completed' ? "opacity-60 grayscale-[0.05]" : "opacity-100"
      )}>
        {/* Distinct vertical accent tracking bar dynamically colored with theme's primary accent */}
        <div className="absolute left-0 top-0 bottom-0 w-2.5 sm:w-3 bg-theme-accent theme-transition group-hover/card:w-4 transition-all duration-300" />

        {/* Group the content items (time block, type/category icons, and title) on the left container */}
        <div className="space-y-3 flex-1 min-w-0 pr-3 sm:pr-4">
          {/* Always Visible Header: Time Range & Optional Completion Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 max-w-full overflow-hidden">
            <span className="text-[10px] sm:text-xs font-sans font-extrabold text-theme-text-secondary bg-theme-bg px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border border-theme-border uppercase tracking-wider theme-transition shrink-0">
              {item.startTime} — {item.endTime}
            </span>
            {item.status === 'completed' && (
              <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-green-100 dark:bg-green-950/20 text-green-700 dark:text-green-400 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full uppercase font-sans font-black tracking-wider border border-green-200 dark:border-green-905/40 shrink-0">
                {lang === 'ID' ? 'Selesai' : 'Done'}
              </span>
            )}
          </div>

          {/* Always Visible: Activity Title */}
          <h3 className={cn(
            "text-base sm:text-2xl font-sans font-black tracking-tight transition-all break-words leading-tight",
            item.status === 'completed' ? "text-theme-text-muted line-through" : "text-theme-text-primary"
          )}>
            {item.title}
          </h3>

          {/* Collapsible/Expandable Meta Info (AI Recommendation, Category/Type labels, and the Date text) */}
          <div className="overflow-hidden transition-all duration-300 ease-in-out max-h-0 opacity-0 space-y-3 group-hover/card:max-h-48 group-hover/card:opacity-100 group-focus/card:max-h-48 group-focus/card:opacity-100 group-focus-within/card:max-h-48 group-focus-within/card:opacity-100">
            <div className="h-0.5" /> {/* Small spacer spacer to separate content */}
            <div className="flex flex-wrap items-center gap-3">
              {item.isAIRecommended && (
                <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-theme-accent-light-bg text-theme-accent px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full uppercase font-sans font-black tracking-wider border border-theme-accent/20 animate-pulse shrink-0">
                  <Sparkles size={10} className="sm:size-3" /> {t.aiPick}
                </span>
              )}
              <div className="flex items-center gap-2 bg-theme-bg border border-theme-border rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 theme-transition">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  item.category === 'Kerja' ? 'bg-blue-500' :
                  item.category === 'Belajar' ? 'bg-green-500' :
                  item.category === 'Hiburan' ? 'bg-pink-500' :
                  item.category === 'Hobi' ? 'bg-orange-500' : 'bg-indigo-500'
                )} />
                <p className="text-[8px] sm:text-[10px] text-theme-text-secondary uppercase tracking-[0.2em] font-serif font-black">
                  {t[item.category.toLowerCase() as keyof typeof t] || item.category}
                </p>
              </div>
              {item.date && (
                <p className="text-[10px] text-theme-text-muted font-serif italic font-medium bg-theme-bg border border-theme-border rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 theme-transition">{item.date}</p>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => onToggleStatus(item.id!, item.status === 'completed' ? 'pending' : 'completed')}
          className={cn(
            "w-10 h-10 sm:w-14 sm:h-14 rounded-full transition-all flex items-center justify-center border-2 sm:border-4 group-hover/card:scale-110 shrink-0 cursor-pointer theme-transition ml-4 self-center",
            item.status === 'completed' 
              ? "text-theme-text-on-accent bg-theme-accent border-theme-card shadow-xl shadow-theme-accent/25" 
              : "text-theme-text-secondary border-theme-border hover:border-theme-accent hover:text-theme-accent bg-theme-card shadow-sm"
          )}
        >
          {item.status === 'completed' ? <CheckCircle2 className="size-5 sm:size-7" /> : <Circle className="size-5 sm:size-7" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6 mb-2 mt-1">
        <div className="space-y-1 w-full">
          <div className="flex flex-row items-center justify-between w-full mt-1 mb-1">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-sans font-black tracking-tight text-theme-text-primary italic leading-none">
              {view === 'daily' ? t.scheduleToday : t[view]}
            </h2>
            <button 
              onClick={onAddActivityClick}
              className="p-3 bg-theme-accent hover:bg-theme-accent-hover text-theme-text-on-accent rounded-2xl transition-all shadow-lg shadow-theme-accent/15 active:scale-95 group cursor-pointer animate-in fade-in duration-300"
              title={t.addActivity}
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
          <p className="text-[10px] font-serif font-semibold text-theme-text-secondary uppercase tracking-[0.3em] px-1">
            {new Date().toLocaleDateString(lang === 'ID' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        
        <div className="flex border-b border-theme-border pb-0.5 gap-6 self-end md:self-auto group/tabs theme-transition relative">
          {(['daily', 'weekly', 'monthly'] as ViewType[]).map((v) => {
            const isActive = view === v;
            return (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className={cn(
                  "relative pb-2 px-3 text-[10px] sm:text-xs font-sans font-black uppercase tracking-wider transition-all duration-305 ease-in-out cursor-pointer theme-transition hover:text-theme-accent rounded-lg",
                  isActive ? "text-theme-accent" : "text-theme-text-secondary"
                )}
              >
                {/* Dynamic hover backdrop */}
                <span className="absolute inset-0 bg-theme-accent/0 group-hover/tabs:bg-theme-accent/5 rounded-lg transition-all duration-300 ease-in-out -z-10" />
                <span>{t[v]}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-theme-accent rounded-full z-10"
                    transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative border-l-2 border-theme-border ml-5 pl-10 space-y-4 py-4 min-h-[400px] theme-transition">
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div
              key="schedule-loader"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-20 px-6 space-y-6 text-center max-w-sm mx-auto"
            >
              <div className="relative flex items-center justify-center w-24 h-24">
                <div className="absolute inset-0 border-4 border-theme-accent/20 rounded-full animate-ping" />
                <div className="absolute w-20 h-20 border-t-4 border-l-4 border-theme-accent rounded-full animate-spin" />
                <Sparkles className="text-theme-accent animate-pulse" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-sans font-black text-theme-text-primary tracking-tight">
                  {lang === 'ID' ? 'Sedang memproses jadwal AI Anda...' : 'Processing your AI schedule...'}
                </h3>
                <p className="text-xs text-theme-text-secondary font-sans leading-relaxed uppercase tracking-widest font-black">
                  {lang === 'ID' ? 'Menyusun ulang jadwal terbaikmu... Mohon tunggu sebentar.' : 'Rearranging your best schedule... Please wait a moment.'}
                </p>
              </div>
            </motion.div>
          ) : currentQuote ? (
            <motion.div 
              key={`discipline-quote-${view}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="text-theme-text-secondary font-serif italic py-20 text-center max-w-sm mx-auto border-2 border-dashed border-theme-border rounded-[2.5rem] bg-theme-card theme-transition"
            >
              "{currentQuote}" <br />
              <span className="text-[10px] uppercase tracking-widest font-mono mt-4 block text-theme-accent">- Jim Rohn</span>
            </motion.div>
          ) : (
            <motion.div 
              key={`view-container-${view}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {view === 'daily' && (
                <div className="space-y-10">
                  {filteredActiveItems.map((item, idx) => (
                    <motion.div
                      key={`daily-list-${item.id || 'new'}-${idx}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, ease: "easeOut", delay: idx * 0.03 }}
                    >
                      {renderItem(item, idx)}
                    </motion.div>
                  ))}

                  {filteredActiveItems.length > 0 && onResetDaily && (
                    <div className="flex justify-end pt-4">
                      <button
                        onClick={onResetDaily}
                        className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl border border-red-500/20 text-xs font-sans font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Trash2 size={12} /> {lang === 'ID' ? 'Atur Ulang Hari Ini' : 'Reset Today'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {view === 'weekly' && (
                <div className="space-y-4">
                  {Object.keys(groupedItems || {}).length > 0 && onResetWeekly && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={onResetWeekly}
                        className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl border border-red-500/20 text-xs font-sans font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Trash2 size={12} /> {lang === 'ID' ? 'Atur Ulang Pekan Ini' : 'Reset Weekly'}
                      </button>
                    </div>
                  )}
                  {Object.entries(groupedItems || {})
                    .sort(([dayA], [dayB]) => {
                      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                      // Find index in English day names or translated day names
                      const getIndex = (label: string) => {
                        const idx = dayNames.findIndex(name => 
                          t[name as keyof typeof t] === label || name === label.toLowerCase()
                        );
                        return idx === -1 ? 999 : idx;
                      };
                      return getIndex(dayA) - getIndex(dayB);
                    })
                    .map(([day, group]) => (
                    <AccordionItem 
                      key={`weekly-group-${day}`} 
                      title={day} 
                      isOpen={!!expandedSections[day]} 
                      onToggle={() => toggleSection(day, (group as any).date)}
                    >
                      <div className="space-y-8 pt-6">
                        {((group as any).items as ScheduleItem[]).map((item, idx) => (
                          <motion.div 
                            key={`weekly-task-${item.id || 'new'}-${(group as any).date}-${idx}`}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut", delay: idx * 0.03 }}
                          >
                            {renderItem(item, idx)}
                          </motion.div>
                        ))}
                      </div>
                    </AccordionItem>
                  ))}
                </div>
              )}

              {view === 'monthly' && (
                <div className="space-y-4">
                  {Object.keys(groupedItems || {}).length > 0 && onResetMonthly && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={onResetMonthly}
                        className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl border border-red-500/20 text-xs font-sans font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Trash2 size={12} /> {lang === 'ID' ? 'Atur Ulang Bulan Ini' : 'Reset Monthly'}
                      </button>
                    </div>
                  )}
                  {Object.entries(groupedItems || {})
                    .sort(([weekA], [weekB]) => {
                      const getNum = (s: string) => parseInt(s.replace(/\D/g, '')) || 0;
                      return getNum(weekA) - getNum(weekB);
                    })
                    .map(([week, days]) => (
                    <AccordionItem 
                      key={`monthly-group-${week}`} 
                      title={week} 
                      isOpen={!!expandedSections[week]} 
                      onToggle={() => toggleSection(week)}
                      isMainLevel
                    >
                      <div className="space-y-4 pt-4 ml-4">
                        {Object.entries(days as Record<string, { items: ScheduleItem[], date: string }>)
                          .sort(([dayA], [dayB]) => {
                            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                            const getIndex = (label: string) => {
                              const idx = dayNames.findIndex(name => 
                                t[name as keyof typeof t] === label || name === label.toLowerCase()
                              );
                              return idx === -1 ? 999 : idx;
                            };
                            return getIndex(dayA) - getIndex(dayB);
                          })
                          .map(([day, group]) => (
                          <AccordionItem 
                            key={`monthly-group-${week}-${day}`} 
                            title={day} 
                            isOpen={!!expandedSections[`${week}-${day}`]} 
                            onToggle={() => toggleSection(`${week}-${day}`, group.date)}
                          >
                            <div className="space-y-8 pt-6">
                              {group.items.map((item, idx) => (
                                <motion.div 
                                  key={`monthly-task-${item.id || 'new'}-${week}-${day}-${idx}`}
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.3, ease: "easeOut", delay: idx * 0.03 }}
                                >
                                  {renderItem(item, idx)}
                                </motion.div>
                              ))}
                            </div>
                          </AccordionItem>
                        ))}
                      </div>
                    </AccordionItem>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  isMainLevel?: boolean;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ title, children, isOpen, onToggle, isMainLevel }) => {
  return (
    <div className={cn(
      "overflow-hidden transition-all duration-300",
      isMainLevel ? "border-b border-theme-border last:border-0 pb-4 mb-4" : "mb-2"
    )}>
      <button 
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group cursor-pointer theme-transition",
          isOpen ? "bg-theme-accent text-theme-text-on-accent shadow-xl shadow-theme-accent/10" : "bg-theme-card border border-theme-border text-theme-text-primary hover:bg-theme-accent-light-bg hover:text-theme-accent"
        )}
      >
        <span className={cn(
          "text-xs font-mono font-black uppercase tracking-[0.4em] theme-transition",
          isOpen ? "text-theme-text-on-accent" : "text-theme-text-primary"
        )}>{title}</span>
        {isOpen ? <ChevronDown size={14} className="animate-bounce-slow" /> : <ChevronRight size={14} className="text-theme-text-secondary group-hover:text-theme-accent transition-colors" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
