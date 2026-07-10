import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuthStore();
  const hasLocalPreference = useRef(localStorage.getItem('theme') !== null);

  // Initialize from localStorage immediately to prevent flash
  const [darkMode, setDarkModeState] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });

  // Apply theme on initial mount (before first paint)
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const initialDark = savedTheme === 'dark';
    if (initialDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Sync with user preference when user logs in, but only if
  // user has no local preference already set
  useEffect(() => {
    if (user?.dark_mode !== undefined && !hasLocalPreference.current) {
      setDarkModeState(user.dark_mode);
      applyTheme(user.dark_mode);
    }
  }, [user?.dark_mode]);

  const applyTheme = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkModeState(newValue);
    applyTheme(newValue);
    hasLocalPreference.current = true;

    // Persist to server if authenticated
    if (isAuthenticated) {
      authService.updateProfile({ dark_mode: newValue }).catch(() => {
        // Silently fail — localStorage is the source of truth
      });
    }
  };

  const setDarkMode = (value: boolean) => {
    setDarkModeState(value);
    applyTheme(value);
    hasLocalPreference.current = true;

    // Persist to server if authenticated
    if (isAuthenticated) {
      authService.updateProfile({ dark_mode: value }).catch(() => {});
    }
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};