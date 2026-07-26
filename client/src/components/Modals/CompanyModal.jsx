import { useState, useEffect } from 'react';
import { X, Building2, Users, TrendingUp } from 'lucide-react';

export default function CompanyModal({ onClose, socket, myNode }) {
  const [company, setCompany] = useState(null);
  const [tab, setTab] = useState('overview');
  const [createName, setCreateName] = useState('');
  const [createIndustry, setCreateIndustry] = useState('tech');
  const [salaryInput, setSalaryInput] = useState({});
  const [hireTarget, setHireTarget] = useState('');
  const [hireRole, setHireRole] = useState('staff');

  useEffect(() => {
    if (socket?.connected) socket.emit('get_my_company');
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const hData = (data) => setCompany(data);
    socket.on('company_data', hData);
    return () => socket.off('company_data', hData);
  }, [socket]);

  const hasCompany = company && company.id;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-color)', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 size={24} color="var(--accent-color)" />
            <h2 style={{ margin: 0, color: 'var(--text-color)' }}>公司</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {!hasCompany ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <Building2 size={48} color="var(--text-dim)" style={{ marginBottom: '12px', opacity: 0.5 }} />
            <div style={{ color: 'var(--text-color)', fontSize: '1.1rem', marginBottom: '16px' }}>你還沒有公司</div>
            <div style={{ color: 'var(--text-dim)', marginBottom: '16px' }}>創建公司需要 $50,000</div>
            <div style={{ marginBottom: '12px' }}>
              <input placeholder="公司名稱" value={createName} onChange={e => setCreateName(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }} />
              <select value={createIndustry} onChange={e => setCreateIndustry(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', marginBottom: '12px' }}>
                <option value="tech">科技</option>
                <option value="manufacturing">製造</option>
                <option value="finance">金融</option>
                <option value="service">服務</option>
              </select>
            </div>
            <button
              onClick={() => { if (socket?.connected) socket.emit('create_company', { name: createName, industry: createIndustry }); }}
              disabled={!createName || (myNode?.money || 0) < 50000}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: (myNode?.money || 0) >= 50000 ? 'pointer' : 'not-allowed', background: (myNode?.money || 0) >= 50000 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', color: (myNode?.money || 0) >= 50000 ? '#3B82F6' : 'var(--text-dim)' }}
            >
              創建公司
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setTab('overview')} style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', background: tab === 'overview' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'overview' ? '#00CCFF' : 'var(--text-dim)', border: tab === 'overview' ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>概覽</button>
              <button onClick={() => setTab('employees')} style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', background: tab === 'employees' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'employees' ? '#00CCFF' : 'var(--text-dim)', border: tab === 'employees' ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>員工</button>
              <button onClick={() => setTab('upgrade')} style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', background: tab === 'upgrade' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'upgrade' ? '#00CCFF' : 'var(--text-dim)', border: tab === 'upgrade' ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>升級</button>
            </div>

            {tab === 'overview' && (
              <div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>公司名稱</span>
                    <span style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{company.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>產業</span>
                    <span style={{ color: 'var(--text-color)' }}>{company.industryName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>資金</span>
                    <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>${(company.cash || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>等級</span>
                    <span style={{ color: 'var(--accent-color)' }}>Lv.{company.level}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>員工數</span>
                    <span style={{ color: 'var(--text-color)' }}>{company.employees?.length || 0} 人</span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'employees' && (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ color: 'var(--text-color)', fontWeight: 'bold', marginBottom: '8px' }}>僱用員工</div>
                  <input placeholder="使用者名稱" value={hireTarget} onChange={e => setHireTarget(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }} />
                  <select value={hireRole} onChange={e => setHireRole(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}>
                    <option value="intern">實習生 (招募費 $200)</option>
                    <option value="staff">專員 (招募費 $1,000)</option>
                    <option value="engineer">工程師 (招募費 $5,000)</option>
                    <option value="manager">經理 (招募費 $20,000)</option>
                    <option value="expert">專家 (招募費 $100,000)</option>
                  </select>
                  <button onClick={() => { if (socket?.connected && hireTarget) socket.emit('hire_employee', { targetUserId: hireTarget, role: hireRole }); }} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'rgba(59,130,246,0.2)', color: '#3B82F6' }}>僱用</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {company.employees?.map(emp => (
                    <div key={emp.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>{emp.userId}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{emp.role} | 薪資 ${emp.salary}/分</div>
                      </div>
                      {emp.role !== 'owner' && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => { const s = prompt('新薪資:', emp.salary); if (s) socket.emit('set_salary', { targetUserId: emp.userId, salary: parseInt(s) }); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', fontSize: '0.75rem' }}>薪資</button>
                          <button onClick={() => { if (socket?.connected) socket.emit('fire_employee', emp.userId); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: '0.75rem' }}>開除</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'upgrade' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>辦公室等級</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Lv.{company.level} → Lv.{company.level + 1}</div>
                    </div>
                    <button onClick={() => { if (socket?.connected) socket.emit('upgrade_company', 'level'); }} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(0,200,255,0.3)', cursor: 'pointer', background: 'rgba(0,200,255,0.1)', color: '#00CCFF', fontSize: '0.85rem' }}>${(company.upgradeCosts?.level || 0).toLocaleString()}</button>
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>設備等級</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Lv.{company.equipmentLevel} → Lv.{company.equipmentLevel + 1}</div>
                    </div>
                    <button onClick={() => { if (socket?.connected) socket.emit('upgrade_company', 'equipment'); }} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(0,200,255,0.3)', cursor: 'pointer', background: 'rgba(0,200,255,0.1)', color: '#00CCFF', fontSize: '0.85rem' }}>${(company.upgradeCosts?.equipment || 0).toLocaleString()}</button>
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>品牌等級</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Lv.{company.brandLevel} → Lv.{company.brandLevel + 1}</div>
                    </div>
                    <button onClick={() => { if (socket?.connected) socket.emit('upgrade_company', 'brand'); }} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(0,200,255,0.3)', cursor: 'pointer', background: 'rgba(0,200,255,0.1)', color: '#00CCFF', fontSize: '0.85rem' }}>${(company.upgradeCosts?.brand || 0).toLocaleString()}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
