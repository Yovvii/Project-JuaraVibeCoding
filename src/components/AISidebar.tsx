import React from "react";
import { aiService } from "../services/aiService";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "motion/react";

import { translations } from "../lib/translations";

interface AISidebarProps {
  context: any;
  onRecommended: (items: any[], scope: string, isBypassed?: boolean) => void;
  lang: 'ID' | 'EN';
  onUpdateProfile?: (updates: any) => Promise<void>;
}

export const AISidebar: React.FC<AISidebarProps> = ({ context, onRecommended, lang, onUpdateProfile }) => {
  const t = translations[lang];
  const [messages, setMessages] = React.useState<{role: 'ai' | 'user', text: string}[]>([
    { role: 'ai', text: t.welcome }
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [selectedScope, setSelectedScope] = React.useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isWaitingForDayOverride, setIsWaitingForDayOverride] = React.useState<boolean>(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const mutateSettingsAndBypass = async (alreadySetOverride = false) => {
    if (!alreadySetOverride) {
      setIsWaitingForDayOverride(false);
    }
    const currentDay = getCurrentDayName();

    if (onUpdateProfile && context.allowedDays) {
      if (!context.allowedDays.includes(currentDay)) {
        const nextAllowedDays = [...context.allowedDays, currentDay];
        context.allowedDays = nextAllowedDays;
        try {
          await onUpdateProfile({ allowedDays: nextAllowedDays });
        } catch (err) {
          console.warn("Failed to update profile settings automatically:", err);
        }
      }
    }

    await getAIRecommendation();
  };

  const handleBypass = async () => {
    setIsWaitingForDayOverride(false);
    const confirmMsg = lang === 'ID' ? "Ya, Tetap Tambah" : "Yes, Still Generate";
    setMessages(prev => [...prev, { role: 'user', text: confirmMsg }]);
    const processingMsg = lang === 'ID' ? "Memproses jadwal..." : "Processing schedule...";
    setMessages(prev => [...prev, { role: 'ai', text: processingMsg }]);
    await mutateSettingsAndBypass(true);
  };

  const handleCancelBypass = () => {
    setIsWaitingForDayOverride(false);
    const cancelText = lang === 'ID' ? "Batalkan" : "Cancel";
    setMessages(prev => [...prev, { role: 'user', text: cancelText }]);
    const cancelMsg = lang === 'ID' ? "Pembuatan jadwal dibatalkan." : "Schedule generation canceled.";
    setMessages(prev => [...prev, { role: 'ai', text: cancelMsg }]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);

    if (isWaitingForDayOverride) {
      const cleaned = userMsg.trim().toLowerCase();
      if (cleaned === 'y') {
        setIsWaitingForDayOverride(false);
        const processingMsg = lang === 'ID' ? "Memproses jadwal..." : "Processing schedule...";
        setMessages(prev => [...prev, { role: 'ai', text: processingMsg }]);
        await mutateSettingsAndBypass(true);
      } else if (cleaned === 't' || cleaned === 'n') {
        setIsWaitingForDayOverride(false);
        const cancelMsg = lang === 'ID' ? "Pembuatan jadwal dibatalkan." : "Schedule generation canceled.";
        setMessages(prev => [...prev, { role: 'ai', text: cancelMsg }]);
      } else {
        const remindMsg = lang === 'ID' ? "Mohon ketik 'y' atau 't'." : "Please type 'y' or 'n'.";
        setMessages(prev => [...prev, { role: 'ai', text: remindMsg }]);
      }
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const response = await aiService.chat(userMsg, context);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: t.error }]);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentDayName = () => {
    let baseDate = new Date();
    if (context.activeDayContext) {
      const [year, month, day] = context.activeDayContext.split('-').map(Number);
      baseDate = new Date(year, month - 1, day);
    }
    return baseDate.toLocaleDateString("en-US", { weekday: "short" });
  };

  const getAIRecommendation = async (forceSubmit = false) => {
    const isBypassed = forceSubmit === true;
    const currentDayName = getCurrentDayName(); // e.g., 'Sat' or 'Sun'
    const allowedDays = context.allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const isDayRestricted = !allowedDays.includes(currentDayName);

    if (isDayRestricted && !isBypassed) {
      setLoading(false);
      setIsWaitingForDayOverride(true);
      
      const warningText = lang.toLowerCase() === 'id' 
        ? "Hari ini tidak diizinkan di pengaturanmu. Apakah kamu tetap ingin membuat jadwal baru untuk hari ini?"
        : "Today is restricted in your settings. Do you still want to generate a new schedule for today?";
        
      setMessages(prev => [...prev, { role: 'ai', text: warningText }]);
      return; // ABSOLUTELY STOP EXECUTION HERE
    }

    setIsWaitingForDayOverride(false);
    setLoading(true);

    const executeGeneration = async () => {
      return await aiService.getRecommendations({ ...context, scope: selectedScope });
    };

    try {
      const items = await executeGeneration();
      onRecommended(items, selectedScope, isBypassed);
      setMessages(prev => [...prev, { role: 'ai', text: t.success }]);
    } catch (err: any) {
      const errStr = String(err?.message || err);
      console.warn("Client fallback recommendations inside executeGeneration due to offline/network/quota failure:", err);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const fallbackItems = [
        { title: "Sesi Fokus & Belajar Mandiri", category: "Belajar", startTime: "09:00", endTime: "11:30", date: todayStr, day: dayName, isAIRecommended: true, isManual: false, status: 'pending' as const },
        { title: "Makan Siang & Istirahat", category: "Personal", startTime: "12:00", endTime: "13:00", date: todayStr, day: dayName, isAIRecommended: true, isManual: false, status: 'pending' as const },
        { title: "Evaluasi & Kerja Produktif", category: "Kerja", startTime: "14:00", endTime: "17:00", date: todayStr, day: dayName, isAIRecommended: true, isManual: false, status: 'pending' as const },
        { title: "Olah Raga / Me Time", category: "Hobi", startTime: "17:30", endTime: "18:30", date: todayStr, day: dayName, isAIRecommended: true, isManual: false, status: 'pending' as const }
      ];
      
      onRecommended(fallbackItems, selectedScope, isBypassed);

      const isQuotaError = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("503");
      const textMsg = isQuotaError
        ? (lang === 'ID' 
            ? "Batas kuota AI terlampaui (429/503). Menyajikan rencana aktivitas lokal berkualitas tinggi!" 
            : "AI quota limits exceeded (429/503). Serving high-quality offline schedule fallback!")
        : `${t.errorRec} (Serving stable local offline schedule fallback!)`;

      setMessages(prev => [...prev, { role: 'ai', text: textMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-theme-sidebar-bg text-theme-text-primary rounded-[2.5rem] overflow-hidden shadow-2xl border border-theme-border theme-transition">
      <div className="p-6 border-b border-theme-border flex items-center justify-between flex-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-theme-accent-light-bg flex items-center justify-center theme-transition">
            <Sparkles className="text-theme-accent" size={16} />
          </div>
          <h2 className="font-sans font-black tracking-tight text-sm">Disiplin.AI</h2>
        </div>
        <div className="w-2 h-2 rounded-full bg-theme-accent animate-pulse theme-transition" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
        {messages.map((msg, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={`msg-${i}-${msg.role}`} 
            className={cn(
              "max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === 'ai' 
                ? "bg-theme-bg/60 text-theme-text-primary self-start rounded-tl-none border border-theme-border font-serif font-medium flex flex-col gap-3" 
                : "bg-theme-accent text-theme-text-on-accent self-end ml-auto rounded-tr-none shadow-lg shadow-theme-accent/10 font-sans font-black"
            )}
          >
            <div>{msg.text}</div>
            {isWaitingForDayOverride && msg.role === 'ai' && i === messages.length - 1 && (
              <div className="flex flex-wrap gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleBypass}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-sans font-black uppercase tracking-wider bg-theme-accent text-theme-text-on-accent hover:opacity-95 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                >
                  {lang === 'ID' ? "Ya, Tetap Tambah" : "Yes, Still Generate"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelBypass}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-sans font-black uppercase tracking-wider bg-theme-bg text-theme-text-secondary border border-theme-border hover:bg-theme-accent-light-bg hover:text-theme-accent active:scale-[0.97] transition-all cursor-pointer"
                >
                  {lang === 'ID' ? "Batalkan" : "Cancel"}
                </button>
              </div>
            )}
          </motion.div>
        ))}
        {loading && (
          <div className="bg-theme-bg/60 border border-theme-border p-4 rounded-2xl self-start rounded-tl-none flex items-center gap-3">
            <Loader2 className="animate-spin text-theme-accent" size={14} />
            <span className="text-xs text-theme-text-secondary font-serif">{t.thinking}</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-4 bg-theme-bg/30 border-t border-theme-border flex-none">
        {/* Scope Selection */}
        <div className="grid grid-cols-3 gap-2 px-1">
          {(['daily', 'weekly', 'monthly'] as const).map((scope) => (
            <button
              key={scope}
              onClick={() => setSelectedScope(scope)}
              className={cn(
                "py-2 rounded-xl text-[10px] font-sans font-black uppercase tracking-widest transition-all cursor-pointer",
                selectedScope === scope 
                  ? "bg-theme-accent text-theme-text-on-accent shadow-md" 
                  : "bg-theme-bg text-theme-text-secondary hover:bg-theme-accent-light-bg hover:text-theme-accent border border-theme-border"
              )}
            >
              {lang === 'ID' ? (scope === 'daily' ? 'Hari' : scope === 'weekly' ? 'Minggu' : 'Bulan') : scope}
            </button>
          ))}
        </div>

        <button
          onClick={() => getAIRecommendation(false)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-theme-accent hover:bg-theme-accent-hover disabled:opacity-50 text-theme-text-on-accent py-4 rounded-2xl text-sm font-sans font-black uppercase tracking-widest transition-all shadow-xl shadow-theme-accent/15 active:scale-[0.98] cursor-pointer"
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span className="text-[10px] md:text-base">{t.recommendBtn}</span>
        </button>

        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            className="w-full bg-theme-bg border border-theme-border rounded-[1.25rem] px-5 py-4 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-theme-accent transition-all placeholder:text-theme-text-secondary/40 font-serif text-theme-text-primary"
          />
          <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-text-secondary/40 hover:text-theme-accent transition-colors cursor-pointer">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
