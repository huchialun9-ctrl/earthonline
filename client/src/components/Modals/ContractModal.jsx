import { useState, useEffect } from 'react';
import { X, Briefcase, Clock, DollarSign } from 'lucide-react';

export default function ContractModal({ onClose, socket }) {
  const [templates, setTemplates] = useState([]);
  const [active, setActive] = useState([]);

  useEffect(() => {
    if (socket?.connected) socket.emit('get_contracts');
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const hData = (data) => {
      setTemplates(data.templates || []);
      setActive(data.active || []);
    };
    socket.on('contracts_data', hData);
    return () => socket.off('contracts_data', hData);
  }, [socket]);

  const activeTypes = active.filter(c => c.status === 'in_progress').map(c => c.type);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-color)', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Briefcase size={24} color="var(--accent-color)" />
            <h2 style={{ margin: 0, color: 'var(--text-color)' }}>合約任務</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {active.filter(c => c.status === 'in_progress').length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>進行中</div>
            {active.filter(c => c.status === 'in_progress').map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(0,200,255,0.05)', borderRadius: '8px', marginBottom: '6px', border: '1px solid rgba(0,200,255,0.15)' }}>
                <div>
                  <div style={{ color: 'var(--text-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>{c.name}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>報酬: ${c.reward.toLocaleString()}</div>
                </div>
                {c.expiresAt && (
                  <div style={{ color: 'var(--warning-color)', fontSize: '0.8rem' }}>
                    <Clock size={12} style={{ marginRight: '4px' }} />
                    {Math.max(0, Math.floor((c.expiresAt - Date.now()) / 1000 / 60))}分
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ color: 'var(--text-color)', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>可用合約</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.filter(t => !activeTypes.includes(t.id)).map(t => (
            <div key={t.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{t.name}</span>
                <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>${t.reward.toLocaleString()}</span>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '8px' }}>
                耗時: {Math.floor(t.duration / 60000)}分鐘
                {t.requirement?.minIncome > 0 && ` | 需要收入: ${t.requirement.minIncome}/分`}
              </div>
              <button
                onClick={() => { if (socket?.connected) socket.emit('accept_contract', t.id); }}
                style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid rgba(255,159,67,0.3)', cursor: 'pointer', background: 'rgba(255,159,67,0.1)', color: '#FF9F43', fontSize: '0.85rem' }}
              >
                接受合約
              </button>
            </div>
          ))}
          {templates.length === 0 && <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>暫無可用合約</div>}
        </div>
      </div>
    </div>
  );
}
