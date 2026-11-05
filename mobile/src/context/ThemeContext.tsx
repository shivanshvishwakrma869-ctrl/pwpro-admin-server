import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentLight: string;
  accentText: string;
  tabBar: string;
  inputBg: string;
}

const darkColors: ThemeColors = {
  background: '#0a0a0a',
  card: '#171717',
  cardBorder: '#262626',
  text: '#f5f5f5',
  textSecondary: '#a3a3a3',
  accent: '#22C55E',
  accentLight: 'rgba(34, 197, 94, 0.15)',
  accentText: '#4ADE80',
  tabBar: '#121212',
  inputBg: '#1f1f1f',
};

const lightColors: ThemeColors = {
  background: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#64748b',
  accent: '#16a34a',
  accentLight: 'rgba(22, 163, 74, 0.12)',
  accentText: '#15803d',
  tabBar: '#ffffff',
  inputBg: '#f1f5f9',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    AsyncStorage.getItem('pwpro_theme').then((saved) => {
      if (saved !== null) {
        setIsDark(saved === 'dark');
      }
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('pwpro_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
