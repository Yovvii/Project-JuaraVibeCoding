import React from 'react';

interface ScreenTimeContextType {
  activeSeconds: number;
  screenTimeLimit: number;
  setScreenTimeLimit: React.Dispatch<React.SetStateAction<number>>;
  formattedActiveTime: (lang: 'ID' | 'EN') => string;
  formattedLimitTime: (lang: 'ID' | 'EN') => string;
  percentage: number;
  strokeOffset: number;
  manualResetScreenTime: () => void;
}

const ScreenTimeContext = React.createContext<ScreenTimeContextType | undefined>(undefined);

export const ScreenTimeProvider: React.FC<{ children: React.ReactNode, initialLimit?: number }> = ({ children, initialLimit = 360 }) => {
  const [screenTimeLimit, setScreenTimeLimit] = React.useState<number>(() => {
    try {
      const saved = localStorage.getItem('chronos_screen_time_limit');
      return saved ? parseInt(saved, 10) : initialLimit;
    } catch {
      return initialLimit;
    }
  });

  const [activeSeconds, setActiveSeconds] = React.useState<number>(() => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const savedDate = localStorage.getItem('chronos_screen_time_date');

      if (!savedDate) {
        localStorage.setItem('chronos_screen_time_date', today);
        const logsStr = localStorage.getItem('chronos_screen_time_daily_logs');
        const logs = logsStr ? JSON.parse(logsStr) : {};
        if (logs[today] === undefined) {
          logs[today] = 0;
          localStorage.setItem('chronos_screen_time_daily_logs', JSON.stringify(logs));
        }
        const saved = localStorage.getItem('chronos_screen_time_seconds');
        if (saved) return parseInt(saved, 10);
        return 0; // Default: clean zero-state
      }

      if (savedDate !== today) {
        const logsStr = localStorage.getItem('chronos_screen_time_daily_logs');
        const logs = logsStr ? JSON.parse(logsStr) : {};
        const savedSecs = localStorage.getItem('chronos_screen_time_seconds');
        const oldSec = savedSecs ? parseInt(savedSecs, 10) : 0;
        logs[savedDate] = oldSec;
        logs[today] = 0;

        localStorage.setItem('chronos_screen_time_daily_logs', JSON.stringify(logs));
        localStorage.setItem('chronos_screen_time_date', today);
        localStorage.setItem('chronos_screen_time_seconds', '0');
        return 0;
      }

      const saved = localStorage.getItem('chronos_screen_time_seconds');
      if (saved) return parseInt(saved, 10);
      return 0; // Default
    } catch {
      return 0;
    }
  });

  const activeSecondsRef = React.useRef(activeSeconds);
  React.useEffect(() => {
    activeSecondsRef.current = activeSeconds;
  }, [activeSeconds]);

  const handleMidnightReset = React.useCallback(() => {
    const prevDate = localStorage.getItem('chronos_screen_time_date') || new Date().toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const currentActiveSeconds = activeSecondsRef.current;

    console.log(`Executing midnight reset transition from ${prevDate} to ${today} with active screen time: ${currentActiveSeconds}s`);

    try {
      const logsStr = localStorage.getItem('chronos_screen_time_daily_logs');
      const logs = logsStr ? JSON.parse(logsStr) : {};
      logs[prevDate] = currentActiveSeconds;
      logs[today] = 0;
      localStorage.setItem('chronos_screen_time_daily_logs', JSON.stringify(logs));
    } catch (err) {
      console.warn("Failed to transition daily logs at midnight:", err);
    }

    setActiveSeconds(0);
    try {
      localStorage.setItem('chronos_screen_time_seconds', '0');
      localStorage.setItem('chronos_screen_time_date', today);
    } catch (err) {}

    window.dispatchEvent(new Event('chronos_screen_time_reset'));
  }, []);

  // Midnight Reset Engine
  React.useEffect(() => {
    let timeoutId: any = null;
    let intervalId: any = null;

    const checkAndTriggerReset = () => {
      const today = new Date().toISOString().split('T')[0];
      const savedDate = localStorage.getItem('chronos_screen_time_date');
      if (savedDate && savedDate !== today) {
        handleMidnightReset();
      }
    };

    const setupMidnightTrigger = () => {
      if (timeoutId) clearTimeout(timeoutId);

      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 0
      );
      const msUntilMidnight = midnight.getTime() - now.getTime();

      console.log(`Setting up midnight timeout: ${msUntilMidnight}ms remaining until next day.`);

      timeoutId = setTimeout(() => {
        handleMidnightReset();
        setupMidnightTrigger();
      }, msUntilMidnight);
    };

    setupMidnightTrigger();

    intervalId = setInterval(() => {
      checkAndTriggerReset();
    }, 30000); // Check every 30 seconds

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [handleMidnightReset]);

  // Sync screenTimeLimit with custom event or localStorage updates
  React.useEffect(() => {
    const handleLimitUpdate = () => {
      try {
        const saved = localStorage.getItem('chronos_screen_time_limit');
        if (saved) {
          setScreenTimeLimit(parseInt(saved, 10));
        }
      } catch (err) {
        console.warn(err);
      }
    };
    const handleReset = () => {
      setActiveSeconds(0);
    };
    window.addEventListener('chronos_screen_time_limit_updated', handleLimitUpdate);
    window.addEventListener('chronos_screen_time_reset', handleReset);
    return () => {
      window.removeEventListener('chronos_screen_time_limit_updated', handleLimitUpdate);
      window.removeEventListener('chronos_screen_time_reset', handleReset);
    };
  }, []);

  // Set up screen time interval logic
  React.useEffect(() => {
    let intervalId: any = null;

    const startTimer = () => {
      if (intervalId === null) {
        intervalId = setInterval(() => {
          setActiveSeconds(prev => {
            const next = prev + 1;
            try {
              localStorage.setItem('chronos_screen_time_seconds', next.toString());
            } catch (err) {}
            return next;
          });
        }, 1000); // strictly 1-second intervals
      }
    };

    const stopTimer = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startTimer();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        startTimer();
      } else {
        stopTimer();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      stopTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  const formattedActiveTime = React.useCallback((lang: 'ID' | 'EN') => {
    const h = Math.floor(activeSeconds / 3600);
    const m = Math.floor((activeSeconds % 3600) / 60);
    const s = activeSeconds % 60;
    const mm = m < 10 ? `0${m}` : m;
    const ss = s < 10 ? `0${s}` : s;
    return lang === 'ID' ? `${h}j ${mm}m ${ss}d` : `${h}h ${mm}m ${ss}s`;
  }, [activeSeconds]);

  const formattedLimitTime = React.useCallback((lang: 'ID' | 'EN') => {
    const h = Math.floor(screenTimeLimit / 60);
    const m = screenTimeLimit % 60;
    const mm = m < 10 ? `0${m}` : m;
    return lang === 'ID' ? `${h}j ${mm}m` : `${h}h ${mm}m`;
  }, [screenTimeLimit]);

  const percentage = React.useMemo(() => {
    const limitSec = screenTimeLimit * 60;
    return Math.min(100, Math.max(0, (activeSeconds / limitSec) * 100));
  }, [activeSeconds, screenTimeLimit]);

  const strokeOffset = React.useMemo(() => {
    return 220 - (220 * percentage) / 100;
  }, [percentage]);

  const manualResetScreenTime = React.useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Executing manual screen time reset...`);
    setActiveSeconds(0);
    try {
      localStorage.setItem('chronos_screen_time_seconds', '0');
      localStorage.setItem('chronos_screen_time_date', today);
      
      const logsStr = localStorage.getItem('chronos_screen_time_daily_logs');
      const logs = logsStr ? JSON.parse(logsStr) : {};
      logs[today] = 0;
      localStorage.setItem('chronos_screen_time_daily_logs', JSON.stringify(logs));
    } catch (err) {
      console.warn("Failed to manually clear screen time in localStorage:", err);
    }

    window.dispatchEvent(new Event('chronos_screen_time_reset'));
  }, []);

  return (
    <ScreenTimeContext.Provider
      value={{
        activeSeconds,
        screenTimeLimit,
        setScreenTimeLimit,
        formattedActiveTime,
        formattedLimitTime,
        percentage,
        strokeOffset,
        manualResetScreenTime,
      }}
    >
      {children}
    </ScreenTimeContext.Provider>
  );
};

export const useScreenTime = () => {
  const context = React.useContext(ScreenTimeContext);
  if (context === undefined) {
    throw new Error('useScreenTime must be used within a ScreenTimeProvider');
  }
  return context;
};
