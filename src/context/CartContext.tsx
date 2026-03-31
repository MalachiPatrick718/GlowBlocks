'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: string;
  text: string;
  letterColors: string[];
  quantity: number;
  customColors?: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalBlocks: number;
  shippingMethod: 'standard' | 'express';
  setShippingMethod: (method: 'standard' | 'express') => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function getPricePerBlock(totalBlocks: number): number {
  if (totalBlocks >= 10) return 9.50;
  if (totalBlocks >= 7) return 10.99;
  if (totalBlocks >= 4) return 12.99;
  return 14.99;
}

export function getShippingCost(method: 'standard' | 'express'): number {
  return method === 'express' ? 12.99 : 5.99;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('glowblocks-cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setItems(parsed.items || []);
        setShippingMethod(parsed.shippingMethod || 'standard');
      } catch {}
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem('glowblocks-cart', JSON.stringify({ items, shippingMethod }));
    }
  }, [items, shippingMethod, loaded]);

  const totalBlocks = items.reduce((sum, item) => sum + item.text.replace(/\s/g, '').length * item.quantity, 0);

  const addItem = (newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setItems(prev => [...prev, { ...newItem, id, quantity: 1 }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const clearCart = () => {
    setItems([]);
  };

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQuantity, clearCart,
      totalBlocks, shippingMethod, setShippingMethod,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
