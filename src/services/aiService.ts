import { Habit, ScheduleItem } from "../types";

export const aiService = {
  async getRecommendations(data: {
    habits: Habit[];
    currentSchedule: ScheduleItem[];
    goals: string[];
    morningPerson: boolean;
    view: string;
  }): Promise<ScheduleItem[]> {
    const response = await fetch("/api/gemini/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to get AI recommendations: ${response.status}`);
    }
    return response.json();
  },

  async chat(message: string, context: any): Promise<string> {
    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context }),
    });
    if (!response.ok) throw new Error("Failed to talk to AI");
    const data = await response.json();
    return data.text;
  },
};
