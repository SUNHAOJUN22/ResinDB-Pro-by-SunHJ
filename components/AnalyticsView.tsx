import React from "react";
import { motion } from "motion/react";
import { Breadcrumbs, PageHeader } from "./DashboardComponents";
import { DataVisualizer } from "./DataVisualizer";
import { PieChart } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useData } from "../contexts/DataContext";

export const AnalyticsView: React.FC = () => {
  const { t } = useLanguage();
  const { filteredData, allProducts, selectedIds } = useData();

  return (
    <motion.div
      key="analytics"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col p-5 md:p-8 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden"
    >
      <Breadcrumbs view="analytics" />
      <div className="mt-4 mb-4 md:mb-6">
        <PageHeader
          title={t("scientificVisAnalysis")}
          subtitle={t("multiDimCompare")}
          icon={PieChart}
          color="indigo"
        />
      </div>
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden mb-20 md:mb-0">
        <DataVisualizer
          data={filteredData}
          selectedProducts={allProducts.filter((p) => selectedIds.has(p.id))}
        />
      </div>
    </motion.div>
  );
};
