const StockOrder = require('../models/StockOrder');
const StockHolding = require('../models/StockHolding');
const Company = require('../models/Company');
const User = require('../models/User');
const crypto = require('crypto');

async function placeOrder(companyId, userId, type, price, quantity) {
  const company = await Company.findOne({ id: companyId });
  if (!company) return { success: false, error: '公司不存在' };
  if (quantity <= 0 || price <= 0) return { success: false, error: '無效的數量或價格' };

  if (type === 'buy') {
    const user = await User.findOne({ username: userId });
    const totalCost = Math.ceil(price * quantity * 1.01);
    if (!user || (user.money || 0) < totalCost) return { success: false, error: '金錢不足' };

    const orderId = crypto.randomUUID().slice(0, 8);
    const order = new StockOrder({
      id: orderId,
      companyId,
      userId,
      type: 'buy',
      price,
      quantity,
      filled: 0,
      status: 'open',
      createdAt: Date.now()
    });
    await order.save();

    await matchOrders(companyId);

    return { success: true, orderId };
  } else {
    const holding = await StockHolding.findOne({ userId, companyId });
    const owned = holding ? holding.quantity : 0;
    if (owned < quantity) return { success: false, error: '持股不足' };

    const orderId = crypto.randomUUID().slice(0, 8);
    const order = new StockOrder({
      id: orderId,
      companyId,
      userId,
      type: 'sell',
      price,
      quantity,
      filled: 0,
      status: 'open',
      createdAt: Date.now()
    });
    await order.save();

    await matchOrders(companyId);

    return { success: true, orderId };
  }
}

async function matchOrders(companyId) {
  const buys = await StockOrder.find({ companyId, status: { $in: ['open', 'partial'] }, type: 'buy' }).sort({ price: -1, createdAt: 1 });
  const sells = await StockOrder.find({ companyId, status: { $in: ['open', 'partial'] }, type: 'sell' }).sort({ price: 1, createdAt: 1 });

  let matched = 0;

  for (const buy of buys) {
    const buyRemaining = buy.quantity - buy.filled;
    if (buyRemaining <= 0) continue;

    for (const sell of sells) {
      const sellRemaining = sell.quantity - sell.filled;
      if (sellRemaining <= 0) continue;
      if (sell.price > buy.price) continue;

      const tradeQty = Math.min(buyRemaining, sellRemaining);
      const tradePrice = Math.round((buy.price + sell.price) / 2);

      buy.filled += tradeQty;
      sell.filled += tradeQty;
      buy.status = buy.filled >= buy.quantity ? 'filled' : 'partial';
      sell.status = sell.filled >= sell.quantity ? 'filled' : 'partial';

      await updateHolding(buy.userId, companyId, tradeQty);
      await updateHolding(sell.userId, companyId, -tradeQty);

      const buyer = await User.findOne({ username: buy.userId });
      const seller = await User.findOne({ username: sell.userId });

      const fee = Math.ceil(tradeQty * tradePrice * 0.01);

      if (buyer) {
        buyer.money = (buyer.money || 0) - tradeQty * tradePrice - fee;
        await buyer.save();
      }
      if (seller) {
        seller.money = (seller.money || 0) + tradeQty * tradePrice - fee;
        await seller.save();
      }

      matched += tradeQty;
    }
  }

  const bulkOps = [];
  for (const o of [...buys, ...sells]) {
    bulkOps.push({
      updateOne: {
        filter: { id: o.id },
        update: { $set: { filled: o.filled, status: o.status } }
      }
    });
  }
  if (bulkOps.length > 0) await StockOrder.bulkWrite(bulkOps);

  return matched;
}

async function updateHolding(userId, companyId, qtyChange) {
  let holding = await StockHolding.findOne({ userId, companyId });
  if (!holding) {
    holding = new StockHolding({ userId, companyId, quantity: 0 });
  }
  holding.quantity += qtyChange;
  if (holding.quantity <= 0) {
    await StockHolding.deleteOne({ userId, companyId });
  } else {
    await holding.save();
  }
}

async function cancelOrder(orderId, userId) {
  const order = await StockOrder.findOne({ id: orderId, userId });
  if (!order) return { success: false, error: '訂單不存在' };
  if (order.status === 'filled') return { success: false, error: '訂單已成交' };

  order.status = 'cancelled';
  await order.save();

  if (order.type === 'buy') {
    const remaining = order.quantity - order.filled;
    const user = await User.findOne({ username: userId });
    if (user) {
      user.money = (user.money || 0) + order.price * remaining * 0.99;
      await user.save();
    }
  }

  return { success: true };
}

async function getMarketData() {
  const companies = await Company.find({});
  const orders = await StockOrder.find({ status: { $in: ['open', 'partial'] } });

  return companies.map(c => {
    const companyOrders = orders.filter(o => o.companyId === c.id);
    const bestBid = companyOrders.filter(o => o.type === 'buy').sort((a, b) => b.price - a.price)[0];
    const bestAsk = companyOrders.filter(o => o.type === 'sell').sort((a, b) => a.price - b.price)[0];
    return {
      companyId: c.id,
      companyName: c.name,
      industry: c.industry,
      bestBid: bestBid ? bestBid.price : null,
      bestAsk: bestAsk ? bestAsk.price : null,
      lastPrice: null,
      volume: companyOrders.reduce((s, o) => s + o.filled, 0)
    };
  });
}

async function getOrderBook(companyId) {
  const buys = await StockOrder.find({ companyId, status: { $in: ['open', 'partial'] }, type: 'buy' }).sort({ price: -1 }).limit(20);
  const sells = await StockOrder.find({ companyId, status: { $in: ['open', 'partial'] }, type: 'sell' }).sort({ price: 1 }).limit(20);

  return {
    buys: buys.map(o => ({ price: o.price, quantity: o.quantity - o.filled, userId: o.userId })),
    sells: sells.map(o => ({ price: o.price, quantity: o.quantity - o.filled, userId: o.userId }))
  };
}

async function getPortfolio(userId) {
  const holdings = await StockHolding.find({ userId });
  const companies = await Company.find({});

  return holdings.map(h => {
    const company = companies.find(c => c.id === h.companyId);
    return {
      companyId: h.companyId,
      companyName: company ? company.name : 'Unknown',
      industry: company ? company.industry : '',
      quantity: h.quantity
    };
  });
}

async function getUserOrders(userId) {
  const orders = await StockOrder.find({ userId, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).limit(50);
  return orders.map(o => ({
    id: o.id,
    companyId: o.companyId,
    type: o.type,
    price: o.price,
    quantity: o.quantity,
    filled: o.filled,
    status: o.status,
    createdAt: o.createdAt
  }));
}

module.exports = { placeOrder, cancelOrder, getMarketData, getOrderBook, getPortfolio, getUserOrders };
