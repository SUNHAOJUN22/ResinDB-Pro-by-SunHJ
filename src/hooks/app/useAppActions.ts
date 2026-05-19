import { useCallback } from 'react';
import { Product, User, Toast, ProductUpdates } from '@/types/index';
import { api } from '@/services/api';

interface UseAppActionsProps {
    allProducts: Product[];
    setAllProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    addToast: (type: Toast['type'], message: string) => void;
    t: (key: string, fallback?: string) => string;
    setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>;
    currentUser: User | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export function useAppActions({
        setAllProducts,
    setSelectedIds,
    addToast,
    t,
    setShowSidebar,
    currentUser,
    setCurrentUser
}: UseAppActionsProps) {
    
    const handleDelete = useCallback(async (ids: string[]) => { 
        let previousProducts: Product[] = [];
        setAllProducts(prev => {
            previousProducts = prev;
            return prev.filter(p => !ids.includes(p.id));
        }); 
        setSelectedIds(new Set()); 
        
        try {
            await api.delete(ids);
            addToast('success', t('deleteSuccess').replace('{count}', ids.length.toString())); 
            setShowSidebar(true);
        } catch (error) {
            setAllProducts(previousProducts);
            addToast('error', t('deleteFailed') + (error instanceof Error ? error.message : t('unknownError')));
        }
    }, [setAllProducts, setSelectedIds, addToast, t, setShowSidebar]);

    const handleUpdate = useCallback(async (p: Product) => {
        let previousProducts: Product[] = [];
        setAllProducts(prev => {
            previousProducts = prev;
            return prev.map(old => old.id === p.id ? p : old);
        }); 
        
        try {
            const updated = await api.update(p);
            setAllProducts(prev => prev.map(old => old.id === updated.id ? updated : old)); 
            addToast('success', t('updateSuccessMsg'));
            setShowSidebar(true);
        } catch (error) {
            setAllProducts(previousProducts);
            addToast('error', t('updateFailed') + (error instanceof Error ? error.message : t('unknownError')));
        }
    }, [setAllProducts, addToast, t, setShowSidebar]);

    const handleBatchUpdate = useCallback(async (ids: string[], updates: ProductUpdates) => {
        let previousProducts: Product[] = [];
        const { _propertyUpdates, ...restUpdates } = updates;
        
        setAllProducts(prev => {
            previousProducts = prev;
            return prev.map(p => {
            if (!ids.includes(p.id)) return p;
            
            const newProperties = { ...p.properties };
            if (_propertyUpdates) {
                Object.keys(_propertyUpdates).forEach(key => {
                    const updateVal = _propertyUpdates[key];
                    
                    if (updateVal !== null && typeof updateVal === 'object' && 'value' in updateVal) {
                        // It's a PropertyValue object
                        newProperties[key] = { ...newProperties[key], ...updateVal };
                    } else if (updateVal !== null && (typeof updateVal === 'string' || typeof updateVal === 'number')) {
                        // It's a simple value
                        if (newProperties[key]) {
                            newProperties[key] = { ...newProperties[key], value: updateVal };
                        } else {
                            newProperties[key] = { value: updateVal, unit: '' };
                        }
                    }
                });
            }
            
            return { ...p, ...restUpdates, properties: newProperties };
            });
        }); 
        
        try {
            await api.batchUpdate(ids, restUpdates); 
            addToast('success', t('batchUpdateSuccess'));
            setShowSidebar(true);
        } catch (error) {
            setAllProducts(previousProducts);
            addToast('error', t('batchUpdateFailed') + (error instanceof Error ? error.message : t('unknownError')));
        }
    }, [setAllProducts, addToast, t, setShowSidebar]);

    const handleImportData = useCallback((newProducts: Product[]) => { 
        setAllProducts(prev => [...newProducts, ...prev]); 
        addToast('success', t('importSuccess').replace('{count}', newProducts.length.toString())); 
        setShowSidebar(true);
    }, [setAllProducts, addToast, t, setShowSidebar]);

    const handleUpdateUserProfile = useCallback((updatedData: Partial<User> & { password?: string }) => {
        if (!currentUser) return;
        const newUser = { ...currentUser, ...updatedData };
        setCurrentUser(newUser);
        localStorage.setItem('resindb-session', JSON.stringify(newUser));
        setShowSidebar(true);
        addToast('success', t('updateSuccess'));
    }, [currentUser, setCurrentUser, addToast, t, setShowSidebar]);

    return {
        handleDelete,
        handleUpdate,
        handleBatchUpdate,
        handleImportData,
        handleUpdateUserProfile
    };
}
