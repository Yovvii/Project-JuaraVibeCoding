import React from "react";
import { Habit, HabitCategory } from "../types";
import { Plus, Trash2, Target } from "lucide-react";
import { translations } from "../lib/translations";
import { cn } from "../lib/utils";

interface HabitManagerProps {
  habits: Habit[];
  onAddHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  lang: 'ID' | 'EN';
}

export const HabitManager: React.FC<HabitManagerProps> = ({ habits, onAddHabit, onDeleteHabit, lang }) => {
  const [newTitle, setNewTitle] = React.useState("");
  const [category, setCategory] = React.useState<HabitCategory>("Personal");
  const t = translations[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddHabit({
      userId: "", // Set in parent
      title: newTitle,
      category: category,
      preferredTime: "Morning",
      durationMinutes: 30
    });
    setNewTitle("");
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2 flex-none">
        <Target className="text-theme-text-primary" size={20} />
        <h3 className="text-sm font-sans uppercase tracking-[0.2em] font-black italic text-theme-text-primary">{t.targets}</h3>
      </div>

      <div className="flex flex-col gap-2 flex-none">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t.newHabit}
            className="flex-1 min-w-0 w-full bg-theme-bg border border-theme-border text-theme-text-primary rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent transition-all placeholder:text-theme-text-secondary/40 font-serif"
          />
          <button
            type="submit"
            className="bg-theme-accent hover:bg-theme-accent-hover text-theme-text-on-accent w-11 h-11 shrink-0 flex items-center justify-center rounded-xl transition-colors shadow-lg shadow-theme-accent/15 cursor-pointer"
          >
            <Plus size={20} />
          </button>
        </form>
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {(['Hobi', 'Kerja', 'Belajar', 'Hiburan', 'Personal'] as HabitCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-[10px] font-sans font-black uppercase tracking-widest whitespace-nowrap transition-all border cursor-pointer ${
                category === cat 
                  ? 'bg-theme-accent text-theme-text-on-accent border-theme-accent' 
                  : 'bg-theme-card text-theme-text-secondary border-theme-border hover:border-theme-accent hover:text-theme-accent'
              }`}
            >
              {t[cat.toLowerCase() as keyof typeof t] || cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[150px]">
        {habits.map((habit, idx) => (
          <div key={`habit-${habit.id}-${idx}`} className="flex items-center justify-between p-4 bg-theme-bg rounded-2xl border border-theme-border group shadow-sm hover:shadow-md hover:border-theme-border transition-all">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                habit.category === 'Kerja' ? 'bg-blue-500' :
                habit.category === 'Belajar' ? 'bg-green-500' :
                habit.category === 'Hiburan' ? 'bg-pink-500' :
                habit.category === 'Hobi' ? 'bg-orange-500' : 'bg-indigo-500'
              )} />
              <div>
                <p className="text-sm font-sans font-black text-theme-text-primary">{habit.title}</p>
                <p className="text-[10px] text-theme-text-secondary uppercase tracking-widest font-serif font-semibold">
                  {t[habit.category.toLowerCase() as keyof typeof t] || habit.category}
                </p>
              </div>
            </div>
            <button
              onClick={() => onDeleteHabit(habit.id!)}
              className="text-theme-text-muted hover:text-red-500 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer p-1"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {habits.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-theme-text-muted py-8 font-serif italic text-center">
             <Target size={32} className="mb-2 opacity-50 mx-auto" />
             <p className="text-xs">{t.noHabits}</p>
          </div>
        )}
      </div>
    </div>
  );
};
