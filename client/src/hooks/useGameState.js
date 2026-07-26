import { useState, useEffect } from 'react';

export default function useGameState(socket, API_URL, BASE_URL) {
  const [nodes, setNodes] = useState([]);
  const [myNode, setMyNode] = useState(null);
  const [myRole, setMyRole] = useState('user');
  const [globalStats, setGlobalStats] = useState({ activeUsers: 0, totalPopulation: 0 });
  const [hubStats, setHubStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    let reqId = 0;
    const fetchHub = async () => {
      const myId = ++reqId;
      try {
        const res = await fetch(`${BASE_URL}/api/global/stats`);
        if (res.ok && myId === reqId) setHubStats(await res.json());
      } catch (e) { console.error('[HUB]', e); }
    };
    fetchHub();
    const inv = setInterval(fetchHub, 30000);
    return () => clearInterval(inv);
  }, [BASE_URL]);

  useEffect(() => {
    let reqId = 0;
    const fetchLB = async () => {
      const myId = ++reqId;
      try {
        const res = await fetch(`${API_URL}/leaderboard`, { cache: 'no-store' });
        if (res.ok && myId === reqId) setLeaderboard(await res.json());
      } catch (e) { console.error('[LB]', e); }
    };
    fetchLB();
    const intv = setInterval(fetchLB, 30000);
    return () => clearInterval(intv);
  }, [API_URL]);

  useEffect(() => {
    if (!socket) return;
    const s = socket;

    s.on('init_data', (data) => {
      setMyNode(data);
      setMyRole(data.role || 'user');
    });

    s.on('user_state_update', (data) => {
      setMyNode(prev => prev ? { ...prev, ...data } : data);
    });

    s.on('global_stats', (stats) => setGlobalStats(stats));

    s.on('all_nodes', (data) => setNodes(data));
    s.on('node_connected', (node) => {
      setNodes(prev => prev.find(n => n.id === node.id) ? prev : [...prev, node]);
    });
    s.on('node_disconnected', ({ id }) => {
      setNodes(prev => prev.filter(n => n.id !== id));
    });

    return () => {
      s.off('init_data');
      s.off('user_state_update');
      s.off('global_stats');
      s.off('all_nodes');
      s.off('node_connected');
      s.off('node_disconnected');
    };
  }, [socket]);

  return { nodes, myNode, setMyNode, myRole, globalStats, hubStats, leaderboard };
}
