import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import useSocket from '../hooks/useSocket';
import useGameState from '../hooks/useGameState';
import { getTranslation } from '../i18n';

const GameContext = createContext(null);

export function GameProvider({ children, token, onLogout, region, SOCKET_URL, API_URL, BASE_URL }) {
  const { socket, isConnected, ping } = useSocket(SOCKET_URL, region, token, onLogout);
  const gameStateResult = useGameState(socket, API_URL, BASE_URL);
  const { myNode } = gameStateResult;

  const lang = typeof window !== 'undefined' ? localStorage.getItem('eo_lang') || 'zh' : 'zh';
  const t = (key) => getTranslation(lang, key);

  const [logs, setLogs] = useState([
    { text: `[SYS] ${t('地球在線連線建立中...')}`, time: new Date().toISOString().substring(11, 19) },
  ]);

  const addLog = useCallback((msg, extra = {}) => {
    setLogs(prev => {
      const time = new Date().toISOString().substring(11, 19);
      const logObj = { time, text: typeof msg === 'string' ? msg : msg.text, ...extra };
      return [...prev, logObj].slice(-150);
    });
  }, []);

  const money = myNode?.money ?? 0;
  const incomePerMinute = myNode?.incomePerMinute ?? 1;

  useEffect(() => {
    if (!window.electronAPI || !myNode) return;
    const sendPresence = () => {
      if (window.electronAPI?.updatePresence) {
        window.electronAPI.updatePresence({
          details: `${myNode.username || 'Node'} | ${region.toUpperCase()}`,
          state: `💰 $${Math.floor(money).toLocaleString()} | 💹 +${incomePerMinute}/分`,
          startTimestamp: Date.now(),
          smallImageKey: 'user_icon',
          smallImageText: myNode.username || 'Player',
          buttons: [{ label: '加入遊戲', url: 'https://twonline.dpdns.org' }],
        });
      }
    };
    sendPresence();
    const interval = setInterval(sendPresence, 20000);
    return () => clearInterval(interval);
  }, [myNode, region, money, incomePerMinute]);

  return (
    <GameContext.Provider value={{
      socket, isConnected, ping,
      ...gameStateResult,
      logs, addLog, setLogs,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
