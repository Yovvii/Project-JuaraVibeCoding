import React from "react";
import { ScheduleItem, UserProfile } from "../types";
import { LogOut, Bell, Globe, User, Shield, ChevronRight, Calendar as CalendarIcon, Clock, History as HistoryIcon, RotateCcw, Trash2, ChevronDown, ChevronUp, KeyRound, Mail, Check, Sparkles } from "lucide-react";
import { auth } from "../lib/firebase";
import { translations } from "../lib/translations";
import { useScreenTime } from "../context/ScreenTimeContext";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface SettingsPanelProps {
  profile: UserProfile;
  schedule: ScheduleItem[];
  onUpdate: (updates: Partial<UserProfile>) => void;
  onToggleStatus: (id: string, status: ScheduleItem['status']) => void;
  onDeleteTask: (id: string) => void;
  onClearHistory: () => void;
  lang: 'ID' | 'EN';
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onResetAllSchedules?: () => void;
  onForceAbsoluteFactoryReset: () => Promise<void>;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  profile, 
  schedule, 
  onUpdate, 
  onToggleStatus, 
  onDeleteTask, 
  onClearHistory, 
  lang, 
  isDarkMode, 
  onToggleDarkMode,
  onResetAllSchedules,
  onForceAbsoluteFactoryReset
}) => {
  const t = translations[lang];
  const { manualResetScreenTime } = useScreenTime();
  const [isHistoryExpanded, setIsHistoryExpanded] = React.useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = React.useState(false);
  const [isCredentialSheetOpen, setIsCredentialSheetOpen] = React.useState(false);
  const [savedAccounts, setSavedAccounts] = React.useState<any[]>([]);
  const [isScreenTimeResetDescExpanded, setIsScreenTimeResetDescExpanded] = React.useState(false);
  const [isAllSchedulesResetDescExpanded, setIsAllSchedulesResetDescExpanded] = React.useState(false);

  React.useEffect(() => {
    try {
      const sessionsStr = localStorage.getItem('saved_user_sessions');
      let sessions = sessionsStr ? JSON.parse(sessionsStr) : [];
      
      if (sessions.length === 0 && auth.currentUser) {
        sessions = [{
          email: auth.currentUser.email || "fjryovi@gmail.com",
          name: auth.currentUser.displayName || profile.name || "Yovvv"
        }];
        localStorage.setItem('saved_user_sessions', JSON.stringify(sessions));
      }
      setSavedAccounts(sessions);
    } catch {
      if (auth.currentUser) {
        setSavedAccounts([{
          email: auth.currentUser.email || "fjryovi@gmail.com",
          name: auth.currentUser.displayName || profile.name || "Yovvv"
        }]);
      }
    }
  }, [isCredentialSheetOpen, auth.currentUser, profile.name]);

  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const [screenTimeLimit, setScreenTimeLimit] = React.useState(() => {
    try {
      const saved = localStorage.getItem('chronos_screen_time_limit');
      return saved ? parseInt(saved, 10) : (profile.screenTimeGoal || 360);
    } catch {
      return profile.screenTimeGoal || 360;
    }
  });

  React.useEffect(() => {
    if (profile.screenTimeGoal && profile.screenTimeGoal !== screenTimeLimit) {
      setScreenTimeLimit(profile.screenTimeGoal);
    }
  }, [profile.screenTimeGoal]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const completedItems = schedule.filter(item => item.status === 'completed');

  const toggleDay = (day: string) => {
    const current = profile.allowedDays || [];
    const updated = current.includes(day) 
      ? current.filter(d => d !== day)
      : [...current, day];
    onUpdate({ allowedDays: updated });
  };

  const handleProfileClick = async () => {
    try {
      if (typeof window !== "undefined" && navigator.credentials && navigator.credentials.get) {
        // Native credential request popup triggering
        await navigator.credentials.get({
          federated: {
            providers: ['https://accounts.google.com']
          },
          mediation: 'optional'
        } as any);
      }
    } catch (err) {
      console.warn("Native credential popup sandbox limitation inside preview iframe:", err);
    }
    // Deep fallback: Open the premium interactive account select sheet overlay
    setIsCredentialSheetOpen(true);
  };

  // Profile fields selection logic
  const activeEmail = auth.currentUser ? (auth.currentUser.email || "") : "";
  const activeName = auth.currentUser ? (auth.currentUser.displayName || (profile && profile.name !== "User" ? profile.name : "") || "Yovvv") : "";

  // Premium Custom Theme Mapping Variables
  const containerBg = "bg-transparent text-theme-text-primary";
  const cardBg = "bg-theme-card border-theme-border text-theme-text-primary hover:border-theme-border theme-transition";
  const textPrimary = "text-theme-text-primary";
  const textSecondary = "text-theme-text-secondary";
  const textMuted = "text-theme-text-muted";
  const selectBg = "bg-theme-bg text-theme-text-primary border border-theme-border";
  const btnMuted = "bg-theme-bg hover:bg-theme-accent-light-bg text-theme-text-secondary border border-theme-border";
  const textTitle = "font-sans font-black tracking-tight";
  const textBody = "font-serif text-sm leading-relaxed";

  return (
    <div className={cn("space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 transition-all duration-300", containerBg)}>
      <div className="space-y-1">
        <h2 className={cn("text-3xl font-black uppercase tracking-tight", textTitle, textPrimary)}>{t.settings}</h2>
        <p className={cn(textBody, textSecondary)}>{lang === 'ID' ? 'Kelola pengalaman Disiplin.AI Anda secara mandiri.' : 'Manage your Disiplin.AI experience independently.'}</p>
      </div>

      <div className="space-y-6">
        {/* Profile Info */}
        <div 
          onClick={handleProfileClick}
          className={cn("p-6 rounded-3xl border shadow-sm flex items-center justify-between group cursor-pointer transition-all hover:scale-[1.02] shadow-2xl active:scale-[0.99]", cardBg)}
        >
          <div className="flex items-center gap-4">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden theme-transition border border-theme-border bg-theme-bg", "text-theme-text-muted")}>
               {(auth.currentUser ? (auth.currentUser.photoURL || profile.photoURL) : null) ? <img src={auth.currentUser?.photoURL || profile.photoURL || ""} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={32} />}
            </div>
            <div>
               <p className={cn("font-sans font-black text-lg", textPrimary)}>{activeName}</p>
               <p className={cn("font-sans font-semibold text-sm", textSecondary)}>{activeEmail}</p>
            </div>
          </div>
          <ChevronRight className={cn("transition-colors", "text-theme-text-muted group-hover:text-theme-accent")} />
        </div>

        {/* AI Configuration Section */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 px-2">
              <CalendarIcon size={16} className="text-theme-text-secondary" />
              <h3 className="text-[10px] font-sans font-black uppercase tracking-[0.2em] text-theme-text-secondary">{t.aiConfig}</h3>
           </div>
           
           <div className={cn("p-6 rounded-3xl border shadow-sm space-y-6", cardBg)}>
              <div className="space-y-3">
                 <p className={cn("text-xs font-sans font-bold uppercase tracking-widest", textSecondary)}>{t.allowedDays}</p>
                 <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                       <button
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={cn("w-10 h-10 rounded-xl text-[10px] font-sans font-black transition-all cursor-pointer border",
                             (profile.allowedDays || []).includes(day)
                             ? 'bg-theme-accent border-theme-accent text-theme-text-on-accent shadow-lg shadow-theme-accent/15'
                             : 'bg-theme-bg border-theme-border text-theme-text-secondary hover:bg-theme-accent-light-bg hover:text-theme-accent'
                          )}
                       >
                          {day}
                       </button>
                    ))}
                 </div>
              </div>

              <div className={cn("grid grid-cols-2 gap-4 pt-4 border-t theme-transition", "border-theme-border")}>
                 <div className="space-y-2">
                    <p className={cn("text-[10px] font-sans font-bold uppercase tracking-widest", textSecondary)}>Start Time</p>
                    <input 
                       type="time" 
                       value={profile.allowedStartTime || "08:00"}
                       onChange={(e) => onUpdate({ allowedStartTime: e.target.value })}
                       className={cn("w-full rounded-xl px-4 py-2.5 text-sm font-sans font-bold focus:ring-2 outline-none theme-transition border border-theme-border", "bg-theme-bg text-theme-text-primary focus:ring-theme-accent")}
                    />
                 </div>
                 <div className="space-y-2">
                    <p className={cn("text-[10px] font-sans font-bold uppercase tracking-widest", textSecondary)}>End Time</p>
                    <input 
                       type="time" 
                       value={profile.allowedEndTime || "22:00"}
                       onChange={(e) => onUpdate({ allowedEndTime: e.target.value })}
                       className={cn("w-full rounded-xl px-4 py-2.5 text-sm font-sans font-bold focus:ring-2 outline-none theme-transition border border-theme-border", "bg-theme-bg text-theme-text-primary focus:ring-theme-accent")}
                    />
                 </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-theme-border theme-transition">
                 <p className={cn("text-[10px] font-sans font-bold uppercase tracking-widest", textSecondary)}>DAILY SCREEN TIME LIMIT</p>
                 <select
                    value={screenTimeLimit}
                    onChange={(e) => {
                       const val = parseInt(e.target.value, 10);
                       setScreenTimeLimit(val);
                       try {
                          localStorage.setItem('chronos_screen_time_limit', val.toString());
                       } catch (err) {}
                       onUpdate({ screenTimeGoal: val });
                       window.dispatchEvent(new Event('chronos_screen_time_limit_updated'));
                    }}
                    className={cn("w-full rounded-xl px-4 py-2.5 text-sm font-sans font-bold focus:ring-2 outline-none theme-transition border border-theme-border", "bg-theme-bg text-theme-text-primary focus:ring-theme-accent")}
                 >
                    <option value={120}>2 {lang === 'ID' ? 'Jam' : 'Hours'} (120m)</option>
                    <option value={240}>4 {lang === 'ID' ? 'Jam' : 'Hours'} (240m)</option>
                    <option value={360}>6 {lang === 'ID' ? 'Jam' : 'Hours'} (360m)</option>
                    <option value={480}>8 {lang === 'ID' ? 'Jam' : 'Hours'} (480m)</option>
                    <option value={600}>10 {lang === 'ID' ? 'Jam' : 'Hours'} (600m)</option>
                    <option value={720}>12 {lang === 'ID' ? 'Jam' : 'Hours'} (720m)</option>
                 </select>
              </div>
           </div>
        </div>

        {/* General Settings */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 px-2">
              <Shield size={16} className="text-theme-text-secondary" />
              <h3 className="text-[10px] font-sans font-black uppercase tracking-[0.2em] text-theme-text-secondary">Preferensi</h3>
           </div>

           <div className="space-y-3">
              {/* Notifications */}
              <div className={cn("p-6 rounded-3xl border shadow-sm flex items-center justify-between", cardBg)}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 theme-transition", "bg-orange-100 dark:bg-orange-950/20 text-orange-500")}>
                    <Bell size={24} />
                  </div>
                  <div>
                    <p className="font-sans font-black">{t.notifications}</p>
                    <p className={cn(textBody, "text-xs", textSecondary)}>{lang === 'ID' ? 'Peringatan kegiatan' : 'Activity alerts'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onUpdate({ notificationsEnabled: !profile.notificationsEnabled })}
                  className={cn("w-14 h-8 rounded-full transition-all relative cursor-pointer", profile.notificationsEnabled ? 'bg-theme-accent' : 'bg-theme-border')}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${profile.notificationsEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Language */}
              <div className={cn("p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4", cardBg)}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 theme-transition", "bg-blue-100 dark:bg-blue-950/20 text-blue-500")}>
                    <Globe size={24} />
                  </div>
                  <div>
                    <p className="font-sans font-black">{t.language}</p>
                    <p className={cn(textBody, "text-xs", textSecondary)}>{lang === 'ID' ? 'Pilih bahasa aplikasi' : 'Select app language'}</p>
                  </div>
                </div>
                
                {/* Custom Responsive, Accessible Language Dropdown */}
                <div ref={dropdownRef} className="relative self-start md:self-auto min-w-[180px]">
                  <button
                    type="button"
                    onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 border rounded-xl px-4 py-2.5 text-xs font-sans font-black theme-transition cursor-pointer select-none",
                      "bg-theme-bg border-theme-border text-theme-text-primary hover:border-theme-accent focus:ring-2 focus:ring-theme-accent outline-none"
                    )}
                  >
                    <span>{profile.language === 'ID' ? 'Bahasa Indonesia' : 'English'}</span>
                    <ChevronDown size={14} className={cn("transition-transform duration-300 text-theme-text-secondary", isLangDropdownOpen ? "rotate-180 text-theme-accent" : "")} />
                  </button>

                  <AnimatePresence>
                    {isLangDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.12, ease: "easeInOut" }}
                        className="absolute right-0 left-0 md:left-auto md:w-56 mt-2 bg-theme-card border border-theme-border rounded-xl shadow-2xl overflow-hidden z-[100] p-1.5 space-y-1 theme-transition"
                      >
                        {[
                          { value: 'ID', label: 'Bahasa Indonesia' },
                          { value: 'EN', label: 'English' }
                        ].map((option) => {
                          const isSelected = profile.language === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                onUpdate({ language: option.value as 'ID' | 'EN' });
                                setIsLangDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2.5 rounded-lg text-xs font-sans font-black transition-all cursor-pointer flex items-center justify-between",
                                isSelected 
                                  ? "bg-theme-accent text-theme-text-on-accent" 
                                  : "text-theme-text-primary hover:bg-theme-accent-light-bg hover:text-theme-accent"
                              )}
                            >
                              <span>{option.label}</span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-theme-text-on-accent inline-block" />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Independent Dark Mode (Toggle Switch) */}
              <div className={cn("p-6 rounded-3xl border shadow-sm flex items-center justify-between transition-colors duration-300", cardBg)}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300", "bg-theme-accent-light-bg text-theme-accent")}>
                    {/* Lucide Sun/Moon dynamic swap */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                  </div>
                  <div>
                    <p className="font-sans font-black">Dark Mode</p>
                    <p className={cn(textBody, "text-xs", textSecondary)}>{lang === 'ID' ? 'Tema slate redup mandiri' : 'Independent dim slate theme'}</p>
                  </div>
                </div>
                <button 
                  onClick={onToggleDarkMode}
                  className={cn("w-14 h-8 rounded-full transition-all relative cursor-pointer", isDarkMode ? 'bg-theme-accent' : 'bg-theme-border')}
                >
                  <div className={cn("absolute top-1 w-6 h-6 bg-white rounded-full transition-all", isDarkMode ? 'left-7' : 'left-1')} />
                </button>
              </div>

              {/* Manual Waktu Layar Reset */}
              <div className={cn("p-6 rounded-3xl border shadow-sm flex items-center justify-between", cardBg)}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300 bg-red-100 dark:bg-red-950/20 text-red-500")}>
                    <RotateCcw size={21} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setIsScreenTimeResetDescExpanded(!isScreenTimeResetDescExpanded)}
                      className="flex items-center gap-1.5 hover:text-theme-accent transition-colors text-left"
                    >
                      <span className="font-sans font-black text-sm">{lang === "ID" ? "Atur Ulang Waktu" : "Reset Screen Time"}</span>
                      {isScreenTimeResetDescExpanded ? <ChevronUp size={14} className="opacity-60 shrink-0" /> : <ChevronDown size={14} className="opacity-60 shrink-0" />}
                    </button>
                    {isScreenTimeResetDescExpanded && (
                      <p className={cn(textBody, "text-xs mt-1", textSecondary)}>{lang === "ID" ? "Mereset total seluruh data waktu layar, aktivitas, kebiasaan, dan statistik secara permanen." : "Resets active screen time, habits and stats databases completely."}</p>
                    )}
                  </div>
                </div>
                 <button
                  onClick={async () => {
                    const confirmMsg = lang === "ID" 
                      ? "Apakah Anda yakin ingin menghapus seluruh data? Semua target, jadwal, statistik, dan waktu layar akan dihapus permanen dari cloud."
                      : "Are you sure you want to hard reset all data? This will permanently wipe all targets, schedules, stats, and screen time off the cloud database.";
                    if (window.confirm(confirmMsg)) {
                      await onForceAbsoluteFactoryReset();
                    }
                  }}
                  className="px-4 py-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl transition-all font-sans font-black text-xs text-red-500 cursor-pointer active:scale-95 ml-4 shrink-0"
                >
                  {lang === "ID" ? "Atur" : "Reset"}
                </button>
              </div>

              {/* Reset All Schedules */}
              {onResetAllSchedules && (
                <div className={cn("p-6 rounded-3xl border shadow-sm flex items-center justify-between mt-4", cardBg)}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300 bg-red-100 dark:bg-red-950/20 text-red-500")}>
                      <Trash2 size={21} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setIsAllSchedulesResetDescExpanded(!isAllSchedulesResetDescExpanded)}
                        className="flex items-center gap-1.5 hover:text-theme-accent transition-colors text-left"
                      >
                        <span className="font-sans font-black text-sm">{lang === "ID" ? "Atur Ulang Jadwal" : "Reset All Schedules"}</span>
                        {isAllSchedulesResetDescExpanded ? <ChevronUp size={14} className="opacity-60 shrink-0" /> : <ChevronDown size={14} className="opacity-60 shrink-0" />}
                      </button>
                      {isAllSchedulesResetDescExpanded && (
                        <p className={cn(textBody, "text-xs mt-1", textSecondary)}>{lang === "ID" ? "Menghapus semua data jadwal dari sistem" : "Permanently wipe all schedules from database"}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (window.confirm(lang === "ID" ? "Apakah Anda yakin ingin menghapus semua jadwal?" : "Are you sure you want to completely reset all schedules?")) {
                        await onForceAbsoluteFactoryReset();
                      }
                    }}
                    className="px-4 py-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl transition-all font-sans font-black text-xs text-red-500 cursor-pointer active:scale-95 ml-4 shrink-0"
                  >
                    {lang === "ID" ? "Sapu" : "Wipe"}
                  </button>
                </div>
              )}
           </div>
        </div>

        {/* History Section */}
        <div className="space-y-4 relative">
           <button 
             onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
             className={cn("w-full flex items-center justify-between px-2 group font-sans font-black cursor-pointer", textPrimary)}
           >
              <div className="flex items-center gap-2">
                <HistoryIcon size={16} className="text-theme-text-secondary" />
                <h3 className="text-[10px] font-sans font-black uppercase tracking-[0.2em] text-theme-text-secondary group-hover:text-theme-accent transition-colors">{t.history}</h3>
                <span className={cn("text-[10px] font-sans font-black px-2 py-0.5 rounded-full transition-all theme-transition", "bg-theme-card border border-theme-border text-theme-text-secondary")}>{completedItems.length}</span>
              </div>
              <div className="flex items-center gap-3">
                {isHistoryExpanded ? <ChevronUp size={16} className="text-theme-text-secondary" /> : <ChevronDown size={16} className="text-theme-text-secondary" />}
              </div>
           </button>

           <AnimatePresence>
             {isHistoryExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden animate-in fade-in duration-300"
                >
                  <div className="space-y-3 pb-24">
                     {completedItems.length > 0 ? (
                       completedItems.map((item, idx) => (
                         <motion.div 
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: idx * 0.05 }}
                           key={`hist-${item.id}-${idx}`} 
                           className={cn("p-5 rounded-3xl border shadow-sm flex items-center justify-between group overflow-hidden transition-all duration-300", cardBg)}
                          >
                           <div className="flex flex-col gap-1">
                             <p className={cn("font-sans font-black text-sm", textPrimary)}>{item.title}</p>
                             <p className={cn("font-sans font-semibold text-[10px]", textSecondary)}>{item.date} • {item.startTime} • {item.day}</p>
                           </div>
                           <div className="flex gap-2">
                             <button 
                               onClick={() => onToggleStatus(item.id!, 'pending')}
                               className={cn("p-3 rounded-2xl transition-all flex items-center gap-2 cursor-pointer", "bg-theme-bg border border-theme-border text-theme-text-secondary hover:text-theme-accent hover:bg-theme-accent-light-bg")}
                               title={t.undo}
                             >
                               <RotateCcw size={16} className="transition-transform hover:-rotate-45" />
                             </button>
                             <button 
                               onClick={() => item.id && onDeleteTask(item.id)}
                               className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all group/del cursor-pointer"
                               title="Delete"
                             >
                               <Trash2 size={16} className="group-hover/del:scale-110 transition-transform" />
                             </button>
                           </div>
                         </motion.div>
                       ))
                     ) : (
                       <div className={cn("p-10 text-center border-2 border-dashed rounded-[2.5rem] theme-transition", "border-theme-border bg-theme-card/50")}>
                          <p className={cn(textBody, "text-xs italic text-theme-text-muted")}>{t.historyDesc}</p>
                       </div>
                     )}
                  </div>

                  {/* Sticky Dynamic Controls */}
                  {completedItems.length > 0 && (
                    <div className="sticky bottom-4 left-0 right-0 flex justify-center gap-3 z-10 px-4">
                       <div className={cn("flex gap-2 p-2 rounded-2xl border shadow-2xl backdrop-blur-md", "bg-theme-card/85 border-theme-border")}>
                         <button 
                           onClick={() => setIsHistoryExpanded(false)}
                           className="px-6 py-3 bg-theme-accent hover:bg-theme-accent-hover text-theme-text-on-accent rounded-xl text-[10px] font-sans font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer"
                         >
                           <ChevronUp size={14} /> {lang === 'ID' ? 'Tutup' : 'Collapse'}
                         </button>
                         <button 
                           onClick={onClearHistory}
                           className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-sans font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointerSB"
                         >
                           <Trash2 size={14} /> Clear All
                         </button>
                       </div>
                    </div>
                  )}
                </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Switch Account */}
        <button 
          onClick={() => auth.signOut()}
          className="w-full p-6 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-[2.5rem] border border-red-500/20 flex items-center gap-4 transition-all font-sans font-black group cursor-pointer"
        >
          <div className="w-12 h-12 bg-white dark:bg-zinc-900 group-hover:bg-red-500 group-hover:text-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-95 transition-all text-red-500">
            <LogOut size={24} />
          </div>
          <span className="text-lg">{t.switchAccount}</span>
        </button>
      </div>

      {/* Premium Account / Google Credentials Select Sheet */}
      <AnimatePresence>
        {isCredentialSheetOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsCredentialSheetOpen(false)}
              className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-md bg-theme-card border border-theme-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden theme-transition"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-theme-border pb-4">
                  <div className="w-10 h-10 bg-theme-accent-light-bg rounded-xl flex items-center justify-center shrink-0">
                    <KeyRound className="text-theme-accent" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg/5 font-sans font-black text-theme-text-primary tracking-tight">
                      {lang === 'ID' ? 'Daftar Akun Google Terhubung' : 'List Connected Google Account'}
                    </h3>
                    <p className="text-[10px] mt-2 text-theme-text-secondary font-sans font-bold uppercase tracking-widest leading-none">
                      {lang === 'ID' ? 'Kredensial Perangkat Aktif' : 'Active Device Credentials'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {savedAccounts.map((acc, key) => (
                    <div
                      key={key}
                      className="w-full p-4 rounded-2xl border border-theme-border bg-theme-bg text-theme-text-secondary flex items-center justify-between transition-all duration-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-theme-card border border-theme-border flex items-center justify-center shrink-0">
                          <Mail size={16} className="text-theme-text-secondary" />
                        </div>
                        <div>
                          <p className="text-xs font-sans font-black text-theme-text-primary">{acc.name || "User"}</p>
                          <p className="text-[10px] font-mono text-theme-text-secondary">{acc.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => setIsCredentialSheetOpen(false)}
                    className="w-full py-3.5 bg-theme-bg text-theme-text-secondary font-sans font-black text-xs uppercase tracking-widest rounded-xl hover:bg-theme-accent-light-bg transition-all text-center cursor-pointer"
                  >
                    {lang === 'ID' ? 'Batal' : 'Cancel'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
