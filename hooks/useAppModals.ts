import { useState, useCallback } from 'react';
import { Product } from '../types';

export function useAppModals() {
    const [modals, setModals] = useState({
        import: false,
        systemHealth: false,
        feedback: false,
        help: false,
        shortcuts: false,
        commandPalette: false,
        profile: false,
        admin: false,
        batchEdit: false,
        comparison: false,
        detailDrawer: false,
        formulaEditor: false
    });

    const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

    const openModal = useCallback((name: keyof typeof modals) => {
        setModals(prev => ({ ...prev, [name]: true }));
    }, []);

    const closeModal = useCallback((name: keyof typeof modals) => {
        setModals(prev => ({ ...prev, [name]: false }));
    }, []);

    const toggleModal = useCallback((name: keyof typeof modals) => {
        setModals(prev => ({ ...prev, [name]: !prev[name] }));
    }, []);

    const closeAllModals = useCallback(() => {
        setModals({
            import: false,
            systemHealth: false,
            feedback: false,
            help: false,
            shortcuts: false,
            commandPalette: false,
            profile: false,
            admin: false,
            batchEdit: false,
            comparison: false,
            detailDrawer: false,
            formulaEditor: false
        });
        setViewingProduct(null);
    }, []);

    const openDetail = useCallback((product: Product) => {
        setViewingProduct(product);
        openModal('detailDrawer');
    }, [openModal]);

    const closeDetail = useCallback(() => {
        setViewingProduct(null);
        closeModal('detailDrawer');
    }, [closeModal]);

    return {
        ...modals,
        viewingProduct,
        openModal,
        closeModal,
        toggleModal,
        closeAllModals,
        openDetail,
        closeDetail,
        setViewingProduct
    };
}
