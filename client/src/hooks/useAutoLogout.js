import { useEffect, useRef } from 'react';

export function useAutoLogout(isActive, timeoutInMinutes, onTimeout) {
  const timeoutIdRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      return;
    }

    const setupTimer = () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      timeoutIdRef.current = setTimeout(() => {
        onTimeout();
      }, timeoutInMinutes * 60 * 1000);
    };

    const resetTimer = () => {
      setupTimer();
    };

    // Eventos que reiniciam o timer de inatividade
    const events = [
      'mousemove',
      'mousedown',
      'click',
      'scroll',
      'keypress',
      'touchstart',
      'touchmove'
    ];

    setupTimer();

    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [isActive, timeoutInMinutes, onTimeout]);
}
