import { useState, useEffect, useRef } from 'react';

export default function useTimer(socket) {
  const [sessionTime, setSessionTime] = useState(0);
  const sessionStartRef = useRef(null);

  useEffect(() => {
    if (!sessionStartRef.current) sessionStartRef.current = Date.now();
    const interval = setInterval(() => {
      setSessionTime(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onForceSync = () => {
      sessionStartRef.current = Date.now();
      setSessionTime(0);
    };
    socket.on('force_sync', onForceSync);
    return () => { socket.off('force_sync', onForceSync); };
  }, [socket]);

  return { sessionTime };
}
