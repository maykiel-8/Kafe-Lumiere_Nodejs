const { Op } = require('sequelize');
const { sequelize, Order, OrderItem, Item, Size, AddOn, User } = require('../models');
const { logActivity } = require('../utils/logger');
const { buildReceiptPDF } = require('../utils/receipt');

function genOrderNumber() {
  const d = new Date();
  const stamp =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `KL-${stamp}-${rand}`;
}

const includeFull = [
  { model: OrderItem, as: 'items' },
  { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'cashier', attributes: ['id', 'name', 'email'] },
];

// Create an order. Customers create their own; cashiers can create for a customer.
exports.create = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { items, notes, customerId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    // Resolve who the customer is
    let orderCustomerId = null;
    let cashierId = null;
    if (req.user.role === 'customer') {
      orderCustomerId = req.user.id;
    } else {
      cashierId = req.user.id;
      orderCustomerId = customerId || null;
    }

    const sizes = await Size.findAll({ transaction: t });
    const addons = await AddOn.findAll({ transaction: t });
    const sizeMap = Object.fromEntries(sizes.map((s) => [s.name, s]));
    const addonMap = Object.fromEntries(addons.map((a) => [a.id, a]));

    const order = await Order.create(
      {
        orderNumber: genOrderNumber(),
        customerId: orderCustomerId,
        cashierId,
        status: 'pending',
        notes: notes || null,
      },
      { transaction: t }
    );

    let subtotal = 0;
    for (const line of items) {
      const dbItem = await Item.findByPk(line.itemId, { transaction: t });
      if (!dbItem || !dbItem.available) {
        await t.rollback();
        return res.status(400).json({ message: `Item unavailable: ${line.itemId}` });
      }
      const qty = Math.max(1, parseInt(line.quantity) || 1);
      const size = line.sizeName ? sizeMap[line.sizeName] : null;
      const sizeMod = size ? Number(size.priceModifier) : 0;
      const unitPrice = Number(dbItem.basePrice) + sizeMod;

      const selectedAddons = (line.addonIds || [])
        .map((id) => addonMap[id])
        .filter(Boolean)
        .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) }));
      const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);

      const lineTotal = (unitPrice + addonsTotal) * qty;
      subtotal += lineTotal;

      await OrderItem.create(
        {
          orderId: order.id,
          itemId: dbItem.id,
          itemName: dbItem.name,
          sizeName: size ? size.name : 'Regular',
          sugarLevel: line.sugarLevel || '100%',
          iceLevel: line.iceLevel || 'Regular',
          quantity: qty,
          unitPrice,
          addonsTotal,
          lineTotal,
          addonsJson: JSON.stringify(selectedAddons),
        },
        { transaction: t }
      );
    }

    order.subtotal = subtotal;
    order.total = subtotal;
    await order.save({ transaction: t });

    await t.commit();
    await logActivity(req.user.id, 'create_order', `Order ${order.orderNumber} created`, req);

    const full = await Order.findByPk(order.id, { include: includeFull });
    res.status(201).json({ message: 'Order placed', order: full });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// List orders. Customers only see their own; staff see all.
exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const status = req.query.status;

    const where = {};
    if (req.user.role === 'customer') where.customerId = req.user.id;
    if (status) where.status = status;
    if (search) where.orderNumber = { [Op.like]: `%${search}%` };

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: includeFull,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    res.json({
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: includeFull });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.user.role === 'customer' && order.customerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
};

// Update order status (staff only)
exports.updateStatus = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: includeFull });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const { status } = req.body;
    const allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    order.status = status;
    await order.save();
    await logActivity(req.user.id, 'update_order_status', `Order ${order.orderNumber} -> ${status}`, req);
    res.json({ message: 'Status updated', order });
  } catch (err) {
    next(err);
  }
};

// Download receipt PDF for an order
exports.receipt = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [...includeFull, { association: 'transaction' }],
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.user.role === 'customer' && order.customerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const pdf = await buildReceiptPDF(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${order.orderNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    await order.destroy();
    await logActivity(req.user.id, 'delete_order', `Deleted order #${req.params.id}`, req);
    res.json({ message: 'Order deleted' });
  } catch (err) {
    next(err);
  }
};
