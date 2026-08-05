'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 3 horas sin actividad — solo se usa en el panel de la distribuidora (no en el catálogo de clientes). */
export const INACTIVITY_TIMEOUT_MS = 3 * 60 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

/**
 * Detecta inactividad del usuario (sin mouse/teclado/scroll) y expone un
 * estado `locked` que se puede prender solo (por inactividad) o a mano
 * (`lock()`, para el botón "Bloquear pantalla"). Una vez bloqueado, mover el
 * mouse NO lo desbloquea — hace falta pasar por `unlock()` (que valida la
 * contraseña/código contra el backend antes de llamarlo), así que el timer
 * de inactividad queda pausado mientras está bloqueado.
 */
export function useIdleTimer(timeoutMs: number = INACTIVITY_TIMEOUT_MS) {
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleLock = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setLocked(true), timeoutMs);
  }, [clearTimer, timeoutMs]);

  useEffect(() => {
    scheduleLock();

    function handleActivity() {
      // Mientras está bloqueada, ignoramos la actividad — no queremos que
      // mover el mouse sobre el overlay reinicie el reloj ni la desbloquee.
      if (lockedRef.current) return;
      scheduleLock();
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity));
      clearTimer();
    };
  }, [scheduleLock, clearTimer]);

  const lock = useCallback(() => {
    clearTimer();
    setLocked(true);
  }, [clearTimer]);

  const unlock = useCallback(() => {
    setLocked(false);
    scheduleLock();
  }, [scheduleLock]);

  return { locked, lock, unlock };
}
