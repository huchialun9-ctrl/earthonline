import { useState, useEffect } from 'react';
import { X, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';

export default function StockModal({ onClose, socket }) {
  const [market, setMarket] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [orderBook, setOrderBook] = useState(null);
  const [buyPrice, setBuyPrice] = useState('');
  const [buyQty, setBuyQty] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [myOrders, setMyOrders] = useState([]);
  const [tab, setTab] = useState('market');

  useEffect(() => {
    if (socket?.connected) {
      socket.emit('get_market_data');
      socket.emit('get_portfolio');
      socket.emit('get_my_orders');
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const hMarket = (data) => setMarket(data || []);
    const hPortfolio = (data) => setPortfolio(data || []);
    const hOrders = (data) => setMyOrders(data || []);
    const hBook = (data) => setOrderBook(data);
    socket.on('market_data', hMarket);
    socket.on('portfolio', hPortfolio);
    socket.on('my_orders', hOrders);
    socket.on('order_book', hBook);
    return () => {
      socket.off('market_data', hMarket);
      socket.off('portfolio', hPortfolio);
      socket.off('my_orders', hOrders);
      socket.off('order_book', hBook);
    };
  }, [socket]);

  const selectCompany = (c) => {
    setSelectedCompany(c);
    if (socket?.connected) socket.emit('get_order_book', c.companyId);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-color)', borderRadius: '16px', width: '90%', maxWidth: '700px', maxHeight: '85vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={24} color="var(--accent-color)" />
            <h2 style={{ margin: 0, color: 'var(--text-color)' }}>股票市場</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button onClick={() => setTab('market')} style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', background: tab === 'market' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'market' ? '#00CCFF' : 'var(--text-dim)', border: tab === 'market' ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>市場行情</button>
          <button onClick={() => setTab('portfolio')} style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', background: tab === 'portfolio' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'portfolio' ? '#00CCFF' : 'var(--text-dim)', border: tab === 'portfolio' ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>我的持倉</button>
          <button onClick={() => setTab('orders')} style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', background: tab === 'orders' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)', color: tab === 'orders' ? '#00CCFF' : 'var(--text-dim)', border: tab === 'orders' ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>我的訂單</button>
        </div>

        {tab === 'market' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {market.map(c => (
                <div key={c.companyId} onClick={() => selectCompany(c)} style={{ cursor: 'pointer', padding: '10px', background: selectedCompany?.companyId === c.companyId ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '8px', border: selectedCompany?.companyId === c.companyId ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{c.companyName}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{c.industry}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '0.85rem' }}>
                    <span>買: <strong style={{ color: '#22C55E' }}>{c.bestBid ? `$${c.bestBid}` : '--'}</strong></span>
                    <span>賣: <strong style={{ color: '#EF4444' }}>{c.bestAsk ? `$${c.bestAsk}` : '--'}</strong></span>
                  </div>
                </div>
              ))}
              {market.length === 0 && <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px' }}>暫無上市公司</div>}
            </div>

            {selectedCompany && orderBook && (
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                <h3 style={{ color: 'var(--text-color)', margin: '0 0 12px 0' }}>{selectedCompany.companyName} - 下單</h3>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>買入</div>
                    <input placeholder="價格" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }} />
                    <input placeholder="數量" value={buyQty} onChange={e => setBuyQty(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }} />
                    <button onClick={() => { if (socket?.connected) { socket.emit('place_order', { companyId: selectedCompany.companyId, type: 'buy', price: parseInt(buyPrice), quantity: parseInt(buyQty) }); setBuyPrice(''); setBuyQty(''); } }} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.2)', color: '#22C55E' }}>買入</button>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>賣出</div>
                    <input placeholder="價格" value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }} />
                    <input placeholder="數量" value={sellQty} onChange={e => setSellQty(e.target.value)} style={{ width: '100%', padding: '6px', marginBottom: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }} />
                    <button onClick={() => { if (socket?.connected) { socket.emit('place_order', { companyId: selectedCompany.companyId, type: 'sell', price: parseInt(sellPrice), quantity: parseInt(sellQty) }); setSellPrice(''); setSellQty(''); } }} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}>賣出</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'portfolio' && (
          <div>
            {portfolio.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px' }}>尚無持股</div>
            ) : portfolio.map(h => (
              <div key={h.companyId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                <div>
                  <div style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{h.companyName}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{h.industry}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{h.quantity} 股</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'orders' && (
          <div>
            {myOrders.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px' }}>尚無訂單</div>
            ) : myOrders.map(o => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                <div>
                  <div style={{ color: 'var(--text-color)' }}>{o.type === 'buy' ? '買入' : '賣出'} ${o.price}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{o.filled}/{o.quantity} 成交</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: o.status === 'filled' ? 'var(--success-color)' : o.status === 'cancelled' ? 'var(--text-dim)' : 'var(--accent-color)', fontSize: '0.85rem' }}>{o.status}</span>
                  {o.status !== 'filled' && o.status !== 'cancelled' && (
                    <button onClick={() => { if (socket?.connected) socket.emit('cancel_order', o.id); }} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', fontSize: '0.75rem' }}>取消</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
