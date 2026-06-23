const { Op } = require('sequelize');
const { Transaction, Order, OrderItem, User } = require('../models');
const { logActivity } = require('../utils/logger');
const { buildReceiptPDF } = require('../utils/receipt');
const { sendMail } = require('../utils/email');

const orderInclude = [
  { model: OrderItem, as: 'items' },
  { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'cashier', attributes: ['id', 'name', 'email'] },
];

async function emailReceipt(order, transaction) {
  if (!order.customer || !order.customer.email) return;
  try {
    const orderForPdf = order.toJSON();
    orderForPdf.transaction = transaction.toJSON();
    const pdf = await buildReceiptPDF(orderForPdf);
    await sendMail({
      to: order.customer.email,
      subject: `Your Kafé Lumière receipt - ${order.orderNumber}`,
      text: `Hi ${order.customer.name},\n\nThank you for your order ${order.orderNumber}. Your receipt is attached.\n\n- Kafé Lumière`,
      html: `<p>Hi ${order.customer.name},</p><p>Thank you for your order <strong>${order.orderNumber}</strong>. Your receipt is attached.</p><p style="color:#6B4E9E">Lumière in every sip.</p>`,
      attachments: [{ filename: `receipt-${order.orderNumber}.pdf`, content: pdf }],
    });
  } catch (err) {
    console.error('Failed to email receipt:', err.message);
  }
}

// Process a cash payment for an order (cashier)
exports.pay = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.body.orderId, { include: orderInclude });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const existing = await Transaction.findOne({ where: { orderId: order.id } });
    if (existing) return res.status(409).json({ message: 'Order is already paid' });

    const amountDue = Number(order.total);
    const amountPaid = Number(req.body.amountPaid);
    if (isNaN(amountPaid) || amountPaid < amountDue) {
      return res.status(400).json({ message: 'Amount paid is insufficient' });
    }
    const change = amountPaid - amountDue;

    const transaction = await Transaction.create({
      orderId: order.id,
      cashierId: req.user.id,
      paymentMethod: 'cash',
      amountDue,
      amountPaid,
      change,
      status: 'paid',
    });

    order.status = 'completed';
    if (!order.cashierId) order.cashierId = req.user.id;
    await order.save();

    await logActivity(req.user.id, 'payment', `Payment for ${order.orderNumber} (change ${change})`, req);

    // term test: email receipt with PDF on payment
    await emailReceipt(order, transaction);

    res.status(201).json({ message: 'Payment recorded', transaction, change });
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const where = {};
    const include = [
      { model: Order, as: 'order', attributes: ['id', 'orderNumber', 'total', 'status'] },
      { model: User, as: 'cashier', attributes: ['id', 'name'] },
    ];
    if (search) {
      include[0].where = { orderNumber: { [Op.like]: `%${search}%` } };
    }

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true,
    });

    res.json({ data: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const tx = await Transaction.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order', include: orderInclude }],
    });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ transaction: tx });
  } catch (err) {
    next(err);
  }
};

// Update a transaction; re-emails the receipt PDF (term test requirement)
exports.update = async (req, res, next) => {
  try {
    const tx = await Transaction.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order', include: orderInclude }],
    });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });

    const { amountPaid, status } = req.body;
    if (amountPaid !== undefined) {
      const paid = Number(amountPaid);
      if (isNaN(paid) || paid < Number(tx.amountDue)) {
        return res.status(400).json({ message: 'Amount paid is insufficient' });
      }
      tx.amountPaid = paid;
      tx.change = paid - Number(tx.amountDue);
    }
    if (status && ['paid', 'refunded'].includes(status)) tx.status = status;
    await tx.save();

    await logActivity(req.user.id, 'update_transaction', `Updated transaction #${tx.id}`, req);

    // send an email when updating the transaction, attaching receipt PDF
    if (tx.order) await emailReceipt(tx.order, tx);

    res.json({ message: 'Transaction updated; receipt emailed to customer', transaction: tx });
  } catch (err) {
    next(err);
  }
};
