'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

export interface CartItem {
  id: string;
  text: string;
  letterColors: string[];
  quantity: number;
  customColors?: boolean;
  hasSymbols?: boolean;
}

export function textHasSymbols(text: string): boolean {
  return text.split('').some(ch => ch !== ' ' && !/[A-Z0-9]/.test(ch));
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  updateItem: (id: string, item: Omit<CartItem, 'id' | 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalBlocks: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function getPricePerBlock(totalBlocks: number): number {
  if (totalBlocks >= 10) return 9.00;
  if (totalBlocks >= 7) return 10.00;
  if (totalBlocks >= 4) return 11.00;
  return 12.00;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('glowblocks-cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setItems(parsed.items || []);
      } catch {}
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem('glowblocks-cart', JSON.stringify({ items }));
    }
  }, [items, loaded]);

  const totalBlocks = useMemo(() =>
    items.reduce((sum, item) => sum + item.text.replace(/[^A-Z0-9]/g, '').length * item.quantity, 0),
    [items]
  );

  const addItem = useCallback((newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setItems(prev => [...prev, { ...newItem, id, quantity: 1 }]);
  }, []);

  const updateItem = useCallback((id: string, updated: Omit<CartItem, 'id' | 'quantity'>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(() => ({
    items, addItem, updateItem, removeItem, updateQuantity, clearCart,
    totalBlocks,
  }), [items, addItem, updateItem, removeItem, updateQuantity, clearCart, totalBlocks]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
