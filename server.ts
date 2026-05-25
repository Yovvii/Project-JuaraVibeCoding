import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini
  const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Helper function to generate clean fallback schedule when Gemini is unavailable (503/High Demand)
  function getFallbackSchedule(scope: string, allowedDays?: string[], allowedStartTime?: string, allowedEndTime?: string): any[] {
    const todayStr = new Date().toISOString().split('T')[0];
    const items: any[] = [];
    
    const standardTemplate = [
      { title: "Sesi Fokus & Belajar Mandiri", category: "Belajar", startTime: "09:00", endTime: "11:30" },
      { title: "Makan Siang & Istirahat", category: "Personal", startTime: "12:00", endTime: "13:00" },
      { title: "Evaluasi & Kerja Produktif", category: "Kerja", startTime: "14:00", endTime: "17:00" },
      { title: "Olah Raga / Me Time", category: "Hobi", startTime: "17:30", endTime: "18:30" },
      { title: "Review Harian & Istirahat", category: "Personal", startTime: "20:00", endTime: "21:30" }
    ];

    const getDayName = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { weekday: "long" });
    };

    if (!scope || scope === 'daily') {
      standardTemplate.forEach((t) => {
        items.push({
          title: t.title,
          category: t.category,
          startTime: t.startTime,
          endTime: t.endTime,
          date: todayStr,
          day: getDayName(todayStr),
          isAIRecommended: true,
          isManual: false,
          status: 'pending'
        });
      });
    } else if (scope === 'weekly') {
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const curDate = new Date();
        curDate.setDate(curDate.getDate() + dayOffset);
        const curDateStr = curDate.toISOString().split('T')[0];
        const dayName = getDayName(curDateStr);
        
        const isWeekend = dayName === 'Saturday' || dayName === 'Sunday';
        if (isWeekend) {
          items.push({
            title: "Ulasan Mingguan & Journaling",
            category: "Personal",
            startTime: "09:30",
            endTime: "11:00",
            date: curDateStr,
            day: dayName,
            isAIRecommended: true,
            isManual: false,
            status: 'pending'
          });
          items.push({
            title: "Hiburan Akhir Pekan",
            category: "Hiburan",
            startTime: "15:00",
            endTime: "18:00",
            date: curDateStr,
            day: dayName,
            isAIRecommended: true,
            isManual: false,
            status: 'pending'
          });
        } else {
          standardTemplate.forEach((t) => {
            items.push({
              title: t.title,
              category: t.category,
              startTime: t.startTime,
              endTime: t.endTime,
              date: curDateStr,
              day: dayName,
              isAIRecommended: true,
              isManual: false,
              status: 'pending'
            });
          });
        }
      }
    } else if (scope === 'monthly') {
      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const curDate = new Date();
        curDate.setDate(curDate.getDate() + dayOffset);
        const curDateStr = curDate.toISOString().split('T')[0];
        const dayName = getDayName(curDateStr);
        const weekNum = Math.floor(dayOffset / 7) + 1;

        items.push({
          title: `Evaluasi & Fokus Utama Minggu ${weekNum}`,
          category: "Kerja",
          startTime: "10:00",
          endTime: "12:00",
          date: curDateStr,
          day: dayName,
          isAIRecommended: true,
          isManual: false,
          status: 'pending'
        });
      }
    }

    // STRICTLY respect active allowedDays & startTime/endTime filters
    if (allowedDays && allowedDays.length > 0) {
      const startLimit = allowedStartTime || "08:00";
      const endLimit = allowedEndTime || "22:00";

      const dayToAbbr = (dayName: string) => {
        if (!dayName) return "Mon";
        return dayName.slice(0, 3);
      };

      const parseMin = (timeStr: string) => {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
      };

      const formatMin = (totalMin: number) => {
        const h = Math.floor(totalMin / 60) % 24;
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      const startBound = parseMin(startLimit);
      const endBound = parseMin(endLimit);

      return items
        .filter(item => {
          const abbr = dayToAbbr(item.day);
          return allowedDays.includes(abbr);
        })
        .map(item => {
          let taskStart = parseMin(item.startTime || "09:00");
          let taskEnd = parseMin(item.endTime || "10:00");
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
            startTime: formatMin(taskStart),
            endTime: formatMin(taskEnd)
          };
        })
        .filter(item => {
          const s = parseMin(item.startTime);
          const e = parseMin(item.endTime);
          return s >= startBound && e <= endBound && s < e;
        });
    }

    return items;
  }

  // API Endpoints
  app.post("/api/gemini/recommend", async (req, res) => {
    const { habits, currentSchedule, goals, morningPerson, scope, allowedDays, allowedStartTime, allowedEndTime } = req.body;
    try {
      const prompt = `
        You are a discipline coach and expert daily planner.
        User context:
        - Morning person: ${morningPerson}
        - Goals: ${JSON.stringify(goals)}
        - Recurring Habits: ${JSON.stringify(habits)}
        - Scope of Generation: ${scope || 'daily'}
        
        STRICT TIMING & DAY BOUNDARY FILTERS:
        - Only generate tasks on these days: ${JSON.stringify(allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
        - All tasks' startTime and endTime must reside strictly inside the boundary: ${allowedStartTime || "08:00"} to ${allowedEndTime || "22:00"}
        - Discard/prevent generating any task outside these boundaries or on deselected days!
        
        Task: 
        Generate a schedule strictly adhering to the selected Scope.
        
        CRITICAL SCOPE RULES:
        1. daily: Generate items for EXACTLY one day (${new Date().toISOString().split('T')[0]}).
        2. weekly: Generate items for one full week (7 days). 
           - START DATE: ${new Date().toISOString().split('T')[0]}
           - STRICT WORK/LIFE BALANCE: Saturday and Sunday MUST be marked as "Days Off" (category: "Libur" or "Hiburan"). No intense work or study on weekends.
        3. monthly: Generate a high-level optimized schedule for the next 30 days.
        
        Every task object MUST strictly include:
        - title (string)
        - category (Hobi, Kerja, Belajar, Hiburan, etc)
        - startTime (HH:mm)
        - endTime (HH:mm)
        - date (YYYY-MM-DD)
        - day (Full name e.g. "Monday", "Saturday")
        - isAIRecommended: true
        
        Respond ONLY with a JSON array.
      `;

      const executeGeneration = async () => {
        return await genAI.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });
      };

      try {
        const response = await executeGeneration();
        const text = response.text;
        res.json(JSON.parse(text));
      } catch (genError: any) {
        const errStr = String(genError?.message || genError);
        if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("503")) {
          console.warn("Quota or service limit error (429/503/RESOURCE_EXHAUSTED) intercepted inside executeGeneration. Rendering fallback.", genError);
          const fallback = getFallbackSchedule(scope || 'daily', allowedDays, allowedStartTime, allowedEndTime);
          return res.json(fallback);
        }
        throw genError;
      }
    } catch (error: any) {
      console.warn("Gemini Service Unavailable / High Demand (503), serving high quality fallback:", error);
      // Gracefully return a beautiful pre-compiled structured plan customized to the selected scope and criteria
      const fallback = getFallbackSchedule(scope || 'daily', allowedDays, allowedStartTime, allowedEndTime);
      res.json(fallback);
    }
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, context } = req.body;
      
      const prompt = `
        You are DisiplinAI assistant. You help users manage their schedule and stay disciplined.
        Current context (schedule and habits): ${JSON.stringify(context)}
        User message: ${message}
        
        If the user wants to add or change an item in their schedule, specify the changes clearly.
        If they just need encouragement, be firm but encouraging about discipline.
      `;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.warn("Gemini chat encountered error/503. Intercepting with fallback message:", error);
      // Fallback response so user doesn't experience crash or disruption
      res.json({ 
        text: "Disiplin adalah jembatan antara tujuan dan pencapaian. (Layanan AI sedang padat, tetapi Anda tetap bisa menyusun dan mengelola jadwal harian Anda secara luring dengan lancar!)" 
      });
    }
  });

  // Vite middleware
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
