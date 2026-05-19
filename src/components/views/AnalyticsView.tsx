import React, { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFormulas } from '@/hooks/math/useFormulas';
import { DataVisualizer } from '@/components/charts/DataVisualizer';

export const AnalyticsView: React.FC = () => {
    const { allProducts, selectedIds } = useData();
    const { formulas } = useFormulas();

    const selectedProducts = useMemo(() => {
        return allProducts.filter(p => selectedIds.has(p.id));
    }, [allProducts, selectedIds]);

    return (
        <div className="h-full w-full">
            <DataVisualizer 
                data={allProducts} 
                selectedProducts={selectedProducts} 
                formulas={formulas} 
            />
        </div>
    );
};
