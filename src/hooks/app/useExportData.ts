import { useState, useCallback } from "react";
import { Product, Toast } from '@/types/index';
import { api } from '@/services/api';

export function useExportData(
  filteredData: Product[],
  addToast: (type: Toast["type"], message: string) => void,
  t: (key: string, fallback?: string) => string
) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await api.exportReport(filteredData, "csv");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `ResinDB_Export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      
      // Delay revocation to ensure browser has started the download
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      addToast("success", t("reportGenerated"));
    } catch (error) {
      addToast(
        "error",
        t("exportFailed") +
          (error instanceof Error ? error.message : t("unknownError")),
      );
    } finally {
      setIsExporting(false);
    }
  }, [filteredData, addToast, t]);

  return { isExporting, handleExport };
}
