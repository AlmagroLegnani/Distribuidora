'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import { CartItem, loadCart, saveCart, calcTotal } from '@/lib/cart';

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD'; item: CartItem }
  | { type: 'UPDATE'; productId: string; quantity: number }
  | { type: 'REMOVE'; productId: string }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'LOAD':
      return { items: action.items };
    case 'ADD': {
      const existing = state.items.find((i) => i.productId === action.item.productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === action.item.productId
              ? { ...i, quantity: Math.min(i.quantity + action.item.quantity, i.maxStock) }
              : i
          ),
        };
      }
      return { items: [...state.items, action.item] };
    }
    case 'UPDATE': {
      if (action.quantity <= 0) {
        return { items: state.items.filter((i) => i.productId !== action.productId) };
      }
      return {
        items: state.items.map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: Math.min(action.quantity, i.maxStock) }
            : i
        ),
      };
    }
    case 'REMOVE':
      return { items: state.items.filter((i) => i.productId !== action.productId) };
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children, slug }: { children: React.ReactNode; slug: string }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadCart(slug);
    if (stored.length > 0) dispatch({ type: 'LOAD', items: stored });
  }, [slug]);

  // Persist to localStorage on change
  useEffect(() => {
    saveCart(slug, state.items);
  }, [state.items, slug]);

  const addItem = useCallback((item: CartItem) => dispatch({ type: 'ADD', item }), []);
  const updateQuantity = useCallback(
    (productId: string, quantity: number) =>
      dispatch({ type: 'UPDATE', productId, quantity }),
    []
  );
  const removeItem = useCallback(
    (productId: string) => dispatch({ type: 'REMOVE', productId }),
    []
  );
  const clearCartFn = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    saveCart(slug, []);
  }, [slug]);

  const itemCount = state.items.reduce((s, i) => s + i.quantity, 0);
  const total = calcTotal(state.items);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        itemCount,
        total,
        addItem,
        updateQuantity,
        removeItem,
        clearCart: clearCartFn,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
