import { useState, useEffect } from 'react';
import { X, Percent, Lock, Unlock } from 'lucide-react';

const INVEST_TYPES = [
  { id: 'deposit', name: '定存', risk: '極低', minAmount: 100, returnDesc: '0.1%/分', lockMinutes: 0, color: '#22C55E' },
  { id: 'bond', name: '債券', risk: '低', minAmount: 1000, returnDesc: '0.3%/分', lockMinutes: 30, color: '#3B82F6' },
  { id: 'index_fund', name: '指數基金', risk: '中', minAmount: 5000, returnDesc: '浮動 0.5~1.5%/分', lockMinutes: 0, color: '#F59E0B' },
  { id: 'real_estate', name: '房地產', risk: '中低', minAmount: 50000, returnDesc: '0.8%/分', lockMinutes: 120, color: '#8B5CF6' },
  { id: 'startup', name: '新創投資', risk: '高', minAmount: 2000, returnDesc: '高風險高回報', lockMinutes: 0, color: '#EF4444' },
];

export default function InvestmentModal({ onClose, socket, myNode, setMyNode }) {
  const [investments, setInvestments] = useState({});
  const [money, setMoney] = useState(myNode?.money || 0);
  const [amount, setAmount] = useState({});
  const [tab, setTab] = useState('new');

  useEffect(() => {
    if (socket?.connected) socket.emit('get_investment_data');
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const hData = (data) => {
      setInvestments(data.investments || {});
      setMoney(data.money || 0);
    };
    const hResult = (data) => {
      if (data.success) {
        setMoney(data.money);
        setMyNode(prev => prev ? { ...prev, money: data.money } : prev);
        if (socket?.connected) socket.emit('get_investment_data');
      }
    };
    socket.on('investment_data', hData);
    socket.on('invest_result', hResult);
    return () => {
      socket.off('investment_data', hData);
      socket.off('invest_result', hResult);
    };
  }, [socket, setMyNode]);

  const activeInvestments = Object.entries(investments).filter(([_, inv]) => inv);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-color)', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Percent size={24} color="var(--accent-color)" />
            <h2 style={{ margin: 0, color: 'var(--text-color)' }}>投資</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '16px' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>💰 可用現金</span>
          <div style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.2rem' }}>${money.toLocaleString()}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button onClick={() => setTab('new')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', background: tab === 'new' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'new' ? '#00CCFF' : 'var(--text-dim)', borderColor: tab === 'new' ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)' }}>新投資</button>
          <button onClick={() => setTab('active')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', background: tab === 'active' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'active' ? '#00CCFF' : 'var(--text-dim)', borderColor: tab === 'active' ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)' }}>我的投資 ({activeInvestments.length})</button>
        </div>

        {tab === 'new' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {INVEST_TYPES.map(inv => {
              const invAmount = amount[inv.id] || inv.minAmount;
              return (
                <div key={inv.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{inv.name}</span>
                    <span style={{ color: inv.color, fontSize: '0.85rem' }}>風險: {inv.risk}</span>
                  </div>
                  <div style={{ color: 'var(--success-color)', fontSize: '0.85rem', marginBottom: '8px' }}>{inv.returnDesc}{inv.lockMinutes > 0 ? ` | 鎖倉 ${inv.lockMinutes}分` : ''}</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number" value={invAmount} min={inv.minAmount}
                      onChange={e => setAmount(prev => ({ ...prev, [inv.id]: Math.max(inv.minAmount, parseInt(e.target.value) || 0) }))}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '0.9rem' }}
                    />
                    <button
                      onClick={() => { if (socket?.connected && money >= invAmount) socket.emit('invest', { type: inv.id, amount: invAmount }); }}
                      disabled={money < invAmount}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid', cursor: money >= invAmount ? 'pointer' : 'not-allowed', background: money >= invAmount ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', color: money >= invAmount ? '#22C55E' : 'var(--text-dim)', borderColor: money >= invAmount ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)' }}
                    >
                      投資
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeInvestments.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px' }}>尚無投資</div>
            ) : activeInvestments.map(([id, inv]) => {
              const def = INVEST_TYPES.find(i => i.id === inv.type);
              const isLocked = inv.lockUntil > Date.now();
              return (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                  <div>
                    <div style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{def?.name || inv.type}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>${(inv.amount || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isLocked ? <Lock size={14} color="var(--text-dim)" /> : <Unlock size={14} color="var(--success-color)" />}
                    <button
                      onClick={() => { if (socket?.connected) socket.emit('withdraw_investment', id); }}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: 'var(--text-color)', fontSize: '0.8rem' }}
                    >
                      贖回
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
