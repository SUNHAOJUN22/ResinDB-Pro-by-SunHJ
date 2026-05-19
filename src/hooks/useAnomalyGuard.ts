import { useState } from 'react';

// Wraps the state for Anomaly Guard KDE and Z-Score outlier detection
export function useAnomalyGuard() {
  const [detectAnomaliesKey, setDetectAnomaliesKey] = useState<string | null>(null);
  
  return {
    detectAnomaliesKey,
    setDetectAnomaliesKey,
  };
}
