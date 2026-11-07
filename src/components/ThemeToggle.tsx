'use client';

import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string } = {}) {
  const toggleTheme = () => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.documentElement.dataset.theme = next;
    localStorage.setItem('kinesisflow-theme', next);
    localStorage.removeItem('cinedoc-theme');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`icon-button shrink-0 ${className}`}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
    >
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
      <Moon className="block h-4 w-4 dark:hidden" aria-hidden="true" />
    </button>
  );
}
