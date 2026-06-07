import React, { useMemo, useState, useEffect } from 'react';
import { Server, Activity, Cpu, Database, Network, ChevronRight } from 'lucide-react';
import './datacenter.css';

export default function DataCenterVisualizer({ lifespan, bonusPoints }) {
  // Level Calculation
  const level = useMemo(() => {
    const hours = lifespan / 3600;
    const pt = bonusPoints || 0;
    if (hours >= 100 || pt >= 5000) return 5;
    if (hours >= 24 || pt >= 1000) return 4;
    if (hours >= 5 || pt >= 200) return 3;
    if (hours >= 1 || pt >= 50) return 2;
    return 1;
  }, [lifespan, bonusPoints]);

  const stats = useMemo(() => {
    switch(level) {
      case 1: return { hashrate: '1.5 MH/s', title: '個人筆電', desc: '勉強能連線的二手設備' };
      case 2: return { hashrate: '45.0 MH/s', title: '塔式伺服器', desc: '運作穩定的初階工作站' };
      case 3: return { hashrate: '850.0 GH/s', title: '標準機櫃', desc: '開始具備規模的機房配置' };
      case 4: return { hashrate: '12.5 TH/s', title: '數據群集', desc: '高吞吐量的高階叢集網路' };
      case 5: return { hashrate: '1.2 PB/s', title: '國家級數據中心', desc: '具備量子運算能力的終極設施' };
      default: return { hashrate: '0 H/s', title: '未連線', desc: '等待初始化' };
    }
  }, [level]);

  const progressToNext = useMemo(() => {
    const hours = lifespan / 3600;
    const pt = bonusPoints || 0;
    if (level === 1) return Math.min(100, Math.max((hours/1)*100, (pt/50)*100));
    if (level === 2) return Math.min(100, Math.max((hours/5)*100, (pt/200)*100));
    if (level === 3) return Math.min(100, Math.max((hours/24)*100, (pt/1000)*100));
    if (level === 4) return Math.min(100, Math.max((hours/100)*100, (pt/5000)*100));
    return 100;
  }, [level, lifespan, bonusPoints]);

  return (
    <div className="dc-modern-container">
      {/* Background Ambience */}
      <div className="dc-bg-glow"></div>
      
      {/* Main Content Layout */}
      <div className="dc-layout">
        
        {/* Left Side: Status Panel (Glassmorphism) */}
        <div className="dc-status-card">
          <div className="dc-card-header">
            <Activity className="icon-pulse" size={20} color="var(--accent-color)" />
            <h2>系統營運狀態</h2>
          </div>
          
          <div className="dc-level-badge">
            <div className="level-number">LV {level}</div>
            <div className="level-info">
              <h3>{stats.title}</h3>
              <p>{stats.desc}</p>
            </div>
          </div>

          <div className="dc-metrics">
            <div className="metric-row">
              <Cpu size={16} color="#8892b0" />
              <span>虛擬總算力</span>
              <strong className="hashrate-value">{stats.hashrate}</strong>
            </div>
            <div className="metric-row">
              <Network size={16} color="#8892b0" />
              <span>節點連線數</span>
              <strong>{Math.floor(level * 12.5 + Math.random() * 5)}</strong>
            </div>
          </div>

          {level < 5 ? (
            <div className="dc-progress-section">
              <div className="progress-labels">
                <span>升級進度</span>
                <span>{Math.floor(progressToNext)}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressToNext}%` }}></div>
              </div>
              <p className="progress-hint">持續掛機或累積積分以解鎖更高級設備</p>
            </div>
          ) : (
            <div className="dc-max-level-badge">
              <Server size={18} />
              <span>設施已達最高規格</span>
            </div>
          )}
        </div>

        {/* Right Side: Data Flow Visualizer */}
        <div className="dc-visual-area">
          <div className="data-flow-grid">
            {/* Animated SVG Visualizer based on level */}
            {level === 1 && <LaptopSvg />}
            {level === 2 && <TowerSvg />}
            {level >= 3 && <ServerRacksSvg level={level} />}
          </div>
        </div>

      </div>
    </div>
  );
}

// Minimalistic SVG Components for polished look

function LaptopSvg() {
  return (
    <svg viewBox="0 0 200 200" className="svg-equipment">
      <defs>
        <linearGradient id="screen-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,255,170,0.4)" />
          <stop offset="100%" stopColor="rgba(0,255,170,0.1)" />
        </linearGradient>
      </defs>
      <rect x="50" y="60" width="100" height="60" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="2" />
      <rect x="55" y="65" width="90" height="50" rx="2" fill="url(#screen-glow)" />
      <path d="M 40 125 L 160 125 L 170 135 L 30 135 Z" fill="#334155" />
      {/* Typing animation lines */}
      <rect x="60" y="75" width="40" height="2" fill="#00ffaa" className="type-anim-1" />
      <rect x="60" y="85" width="60" height="2" fill="#00ffaa" className="type-anim-2" />
      <rect x="60" y="95" width="30" height="2" fill="#00ffaa" className="type-anim-3" />
    </svg>
  );
}

function TowerSvg() {
  return (
    <svg viewBox="0 0 200 200" className="svg-equipment">
      <rect x="70" y="40" width="60" height="120" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <rect x="75" y="45" width="50" height="20" rx="2" fill="#1e293b" />
      <rect x="75" y="70" width="50" height="20" rx="2" fill="#1e293b" />
      <circle cx="100" cy="110" r="15" fill="#1e293b" stroke="#334155" strokeWidth="2" />
      {/* Blinking LEDs */}
      <circle cx="85" cy="145" r="3" fill="#00ffaa" className="led-blink-fast" />
      <circle cx="95" cy="145" r="3" fill="#00ffaa" className="led-blink-slow" />
      <circle cx="115" cy="145" r="4" fill="#3b82f6" />
    </svg>
  );
}

function ServerRacksSvg({ level }) {
  const rackCount = level === 3 ? 1 : level === 4 ? 3 : 5;
  
  return (
    <svg viewBox="0 0 400 200" className="svg-equipment-wide">
      {Array.from({ length: rackCount }).map((_, idx) => {
        const xPos = 200 - (rackCount * 30) + (idx * 60);
        return (
          <g key={idx} transform={`translate(${xPos}, 20)`}>
            <rect x="0" y="0" width="45" height="150" rx="2" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
            {/* Server Blades */}
            {Array.from({ length: 12 }).map((_, bIdx) => (
              <g key={bIdx} transform={`translate(5, ${10 + bIdx * 11})`}>
                <rect x="0" y="0" width="35" height="8" fill="#1e293b" />
                <rect x="3" y="2" width="10" height="4" fill="#020617" />
                <circle cx="20" cy="4" r="1.5" fill="#00ffaa" className={`led-blink-${(idx+bIdx)%3 === 0 ? 'fast' : 'slow'}`} />
                <circle cx="25" cy="4" r="1.5" fill="#3b82f6" className={`led-blink-${(idx+bIdx)%2 === 0 ? 'fast' : 'slow'}`} />
              </g>
            ))}
          </g>
        );
      })}
      
      {/* Hologram for level 5 */}
      {level >= 5 && (
        <g transform="translate(200, 100)">
          <circle cx="0" cy="0" r="50" fill="rgba(0,255,170,0.05)" className="holo-pulse" />
          <circle cx="0" cy="0" r="40" fill="none" stroke="rgba(0,255,170,0.4)" strokeWidth="1" strokeDasharray="5,5" className="holo-spin" />
          <Globe2 x="-20" y="-20" size={40} color="rgba(0,255,170,0.8)" />
        </g>
      )}
    </svg>
  );
}
