import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layers, Database, Zap, RefreshCw } from "lucide-react";
import { Product, SyncEvent } from '@/types/index';
import { SummaryCard } from '@/components/features/Dashboard/DashboardComponents';
import { calculateCompleteness } from '@/utils/productUtils';

interface DashboardStatsProps {
  allProducts: Product[];
  showSummary: boolean;
  syncEvents?: SyncEvent[];
  t: (key: string, fallback?: string) => string;
}

export const DashboardStats: React.FC<DashboardStatsProps> = React.memo(
  ({ allProducts, showSummary, t, syncEvents = [] }) => {
    const summaryStats = useMemo(() => {
      const len = allProducts.length;
      if (!len) return { mfgCount: 0, avgComp: 0 };
      const manufacturers = new Set<string>();
      let totalScore = 0;

      for (let i = 0; i < len; i++) {
        const p = allProducts[i];
        manufacturers.add(p.manufacturer);
        totalScore += calculateCompleteness(p);
      }
      return {
        mfgCount: manufacturers.size,
        avgComp: Math.round(totalScore / len),
      };
    }, [allProducts]);

    const today = new Date().toDateString();
    const successfulRefreshes = syncEvents.filter(event => event.status === 'success' && new Date(event.timestamp).toDateString() === today).length;

    return (
      <div className="flex flex-col gap-2 shrink-0">
        <AnimatePresence mode="wait">
          {showSummary && (
            <motion.div
              key="dashboard-summary-cards"
              variants={{
                hidden: { height: 0, opacity: 0, y: -10 },
                show: {
                  height: "auto",
                  opacity: 1,
                  y: 0,
                  transition: {
                    staggerChildren: 0.05,
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  },
                },
              }}
              initial="hidden"
              animate="show"
              exit={{
                height: 0,
                opacity: 0,
                y: -10,
                transition: { duration: 0.2 },
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-hidden"
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <SummaryCard
                  title={t("totalGrades")}
                  value={allProducts.length}
                  subtitle={t('catalogRecordsShown', 'Records in the current catalog')}
                  icon={Layers}
                  color="primary"
                />
              </motion.div>
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <SummaryCard
                  title={t("activeManufacturers")}
                  value={summaryStats.mfgCount}
                  subtitle={t('catalogManufacturersShown', 'Distinct manufacturer labels in this catalog')}
                  icon={Database}
                  color="indigo"
                />
              </motion.div>
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <SummaryCard
                  title={t("avgCompleteness")}
                  value={`${summaryStats.avgComp}%`}
                  subtitle={t('catalogCompletenessDescription', 'Recorded-field completeness, not scientific validation')}
                  icon={Zap}
                  color="amber"
                />
              </motion.div>
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <SummaryCard
                  title={t("observedRefreshesToday", "Successful refreshes today")}
                  value={successfulRefreshes}
                  subtitle={t("observedRefreshesSource", "Observed client refresh events")}
                  icon={RefreshCw}
                  color="emerald"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
