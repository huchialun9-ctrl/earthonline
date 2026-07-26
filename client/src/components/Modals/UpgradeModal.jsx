import { useState, useEffect } from 'react';
import { X, TrendingUp, Coins } from 'lucide-react';

const UPGRADE_DEFS = [
  { id: 'basic_computer', name: '基礎電腦', baseCost: 100, costMultiplier: 1.5, incomePerLevel: 5, icon: '🖥️' },
  { id: 'server_rack', name: '伺服器機架', baseCost: 500, costMultiplier: 1.8, incomePerLevel: 15, icon: '🗄️' },
  { id: 'ai_assistant', name: 'AI 助手', baseCost: 2000, costMultiplier: 2.0, incomePerLevel: 50, icon: '🤖' },
  { id: 'data_center', name: '資料中心', baseCost: 10000, costMultiplier: 2.2, incomePerLevel: 200, icon: '🏢' },
  { id: 'quantum_pc', name: '量子電腦', baseCost: 50000, costMultiplier: 2.5, incomePerLevel: 800, icon: '⚛️' },
];

function getCost(def, level) {
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, level));
}

export default function UpgradeModal({ onClose, socket, myNode, setMyNode }) {
  const [upgrades, setUpgrades] = useState({});
  const [money, setMoney] = useState(myNode?.money || 0);
  const [income, setIncome] = useState(myNode?.incomePerMinute || 1);

  useEffect(() => {
    if (socket?.connected) socket.emit('get_upgrade_data');
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const hData = (data) => {
      setUpgrades(data.upgrades || {});
      setMoney(data.money || 0);
      setIncome(data.incomePerMinute || 1);
    };
    const hResult = (data) => {
      if (data.success) {
        setUpgrades(prev => ({ ...prev, [data.upgradeId]: data.level }));
        setMoney(data.money);
        setIncome(data.incomePerMinute);
        setMyNode(prev => prev ? { ...prev, money: data.money, incomePerMinute: data.incomePerMinute } : prev);
      }
    };
    socket.on('upgrade_data', hData);
    socket.on('upgrade_result', hResult);
    return () => {
      socket.off('upgrade_data', hData);
      socket.off('upgrade_result', hResult);
    };
  }, [socket, setMyNode]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-color)', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={24} color="var(--accent-color)" />
            <h2 style={{ margin: 0, color: 'var(--text-color)' }}>升級商店</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
          <div style={{ flex: 1 }}><span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>💰 現金</span><div style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.2rem' }}>${money.toLocaleString()}</div></div>
          <div style={{ flex: 1 }}><span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>💹 收入/分</span><div style={{ color: 'var(--success-color)', fontWeight: 'bold', fontSize: '1.2rem' }}>+${income.toLocaleString()}</div></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {UPGRADE_DEFS.map(def => {
            const level = upgrades[def.id] || 0;
            const cost = getCost(def, level);
            const currentIncome = def.incomePerLevel * level;
            const nextIncome = def.incomePerLevel * (level + 1);
            const canBuy = money >= cost;

            return (
              <div key={def.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '2rem' }}>{def.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{def.name}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Lv.{level} → +${currentIncome}/分</div>
                  <div style={{ color: 'var(--success-color)', fontSize: '0.8rem' }}>下一級: +${nextIncome}/分</div>
                </div>
                <button
                  onClick={() => { if (socket?.connected && canBuy) socket.emit('buy_upgrade', def.id); }}
                  disabled={!canBuy}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid', cursor: canBuy ? 'pointer' : 'not-allowed',
                    background: canBuy ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                    color: canBuy ? '#00CCFF' : 'var(--text-dim)',
                    borderColor: canBuy ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)',
                    fontSize: '0.85rem', whiteSpace: 'nowrap',
                  }}
                >
                  ${cost.toLocaleString()}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
