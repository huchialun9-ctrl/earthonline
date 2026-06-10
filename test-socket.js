const io = require('socket.io-client');
const s = io('http://localhost:3001/asia');
s.on('connect', () => console.log('CONNECTED:', s.id));
s.on('global_stats', (d) => console.log('STATS:', d.activeUsers, d.multiplier, d.globalProduction));
s.on('connect_error', (e) => console.log('ERR:', e.message));
setTimeout(() => { console.log('Done waiting'); process.exit(0); }, 8000);
