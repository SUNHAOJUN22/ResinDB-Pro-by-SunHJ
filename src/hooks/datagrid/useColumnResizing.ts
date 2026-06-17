import { useState, useCallback, useEffect } from 'react';

export function useColumnResizing(defaultWidths: Record<string, number>) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    let saved = null;
    try {
      saved = localStorage.getItem('resindb-column-widths');
    } catch {
      // Ignore
    }
    if (saved) {
      try {
        return { ...defaultWidths, ...JSON.parse(saved) };
      } catch {
        return defaultWidths;
      }
    }
    return defaultWidths;
  });

  useEffect(() => {
    const handler = setTimeout(() => {
        try {
          localStorage.setItem('resindb-column-widths', JSON.stringify(columnWidths));
        } catch {
          // Ignore
        }
    }, 500);
    return () => clearTimeout(handler);
  }, [columnWidths]);

  const handleResize = useCallback((key: string, newWidth: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [key]: Math.max(newWidth, 60) // Minimum width
    }));
  }, []);

  return {
    columnWidths,
    handleResize
  };
}
