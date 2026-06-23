const { Op, fn, col, literal } = require('sequelize');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Transaction, Order, OrderItem, Item, User } = require('../models');

function rangeFor(period, query) {
  const now = new Date();
  let start;
  let end = new Date();
  if (query.start && query.end) {
    start = new Date(query.start);
    end = new Date(query.end);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  switch (period) {
    case 'weekly': {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      break;
    }
    case 'monthly': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case 'daily':
    default: {
      start = new Date(now);
      break;
    }
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

async function computeSummary(start, end) {
  const where = { createdAt: { [Op.between]: [start, end] }, status: 'paid' };

  const totalRevenue = (await Transaction.sum('amountDue', { where })) || 0;
  const totalTransactions = await Transaction.count({ where });

  // Best sellers within range (join order_items -> orders -> transactions paid)
  const bestSellers = await OrderItem.findAll({
    attributes: [
      'itemName',
      [fn('SUM', col('OrderItem.quantity')), 'qty'],
      [fn('SUM', col('OrderItem.lineTotal')), 'revenue'],
    ],
    include: [
      {
        model: Order,
        as: 'order',
        attributes: [],
        required: true,
        where: { createdAt: { [Op.between]: [start, end] }, status: 'completed' },
      },
    ],
    group: ['itemName'],
    order: [[literal('qty'), 'DESC']],
    limit: 5,
    raw: true,
  });

  return {
    totalRevenue: Number(totalRevenue),
    totalTransactions,
    bestSellers: bestSellers.map((b) => ({
      name: b.itemName,
      qty: Number(b.qty),
      revenue: Number(b.revenue),
    })),
  };
}

// Sales report for daily/weekly/monthly
exports.report = async (req, res, next) => {
  try {
    const period = req.params.period || 'daily';
    const { start, end } = rangeFor(period, req.query);
    const summary = await computeSummary(start, end);
    res.json({ period, start, end, ...summary });
  } catch (err) {
    next(err);
  }
};

// Overview cards for the dashboard
exports.overview = async (req, res, next) => {
  try {
    const today = rangeFor('daily', {});
    const month = rangeFor('monthly', {});
    const [todayStats, monthStats, totalUsers, totalItems, pendingOrders] = await Promise.all([
      computeSummary(today.start, today.end),
      computeSummary(month.start, month.end),
      User.count(),
      Item.count(),
      Order.count({ where: { status: { [Op.in]: ['pending', 'preparing', 'ready'] } } }),
    ]);
    res.json({
      todayRevenue: todayStats.totalRevenue,
      todayTransactions: todayStats.totalTransactions,
      monthRevenue: monthStats.totalRevenue,
      monthTransactions: monthStats.totalTransactions,
      totalUsers,
      totalItems,
      pendingOrders,
      bestSellers: monthStats.bestSellers,
    });
  } catch (err) {
    next(err);
  }
};

// Data for the 3 charts (quiz 7): line (sales over last 7 days),
// bar (best sellers), pie (revenue by category)
exports.charts = async (req, res, next) => {
  try {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);
      days.push({ label: d.toISOString().slice(5, 10), start: d, end: dEnd });
    }
    const lineData = [];
    for (const day of days) {
      const rev =
        (await Transaction.sum('amountDue', {
          where: { createdAt: { [Op.between]: [day.start, day.end] }, status: 'paid' },
        })) || 0;
      lineData.push({ label: day.label, value: Number(rev) });
    }

    const month = rangeFor('monthly', {});
    const summary = await computeSummary(month.start, month.end);

    // Pie: revenue by category (this month)
    const byCategory = await OrderItem.findAll({
      attributes: [[fn('SUM', col('OrderItem.lineTotal')), 'revenue']],
      include: [
        {
          model: Order,
          as: 'order',
          attributes: [],
          required: true,
          where: { createdAt: { [Op.between]: [month.start, month.end] }, status: 'completed' },
        },
        {
          model: Item,
          as: 'item',
          attributes: ['categoryId'],
          include: [{ association: 'category', attributes: ['name'] }],
        },
      ],
      group: ['item.categoryId', 'item->category.id', 'item->category.name'],
      raw: true,
      nest: true,
    });
    const pieData = byCategory.map((r) => ({
      label: (r.item && r.item.category && r.item.category.name) || 'Uncategorized',
      value: Number(r.revenue),
    }));

    res.json({
      line: { title: 'Sales (Last 7 Days)', data: lineData },
      bar: { title: 'Best Sellers (This Month)', data: summary.bestSellers.map((b) => ({ label: b.name, value: b.qty })) },
      pie: { title: 'Revenue by Category (This Month)', data: pieData },
    });
  } catch (err) {
    next(err);
  }
};

// Export report as Excel
exports.exportExcel = async (req, res, next) => {
  try {
    const period = req.params.period || 'daily';
    const { start, end } = rangeFor(period, req.query);
    const summary = await computeSummary(start, end);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kafé Lumière';
    const ws = wb.addWorksheet('Sales Report');

    ws.addRow(['Kafé Lumière - Sales Report']);
    ws.addRow([`Period: ${period}`]);
    ws.addRow([`From: ${start.toLocaleString()}  To: ${end.toLocaleString()}`]);
    ws.addRow([]);
    ws.addRow(['Total Revenue', summary.totalRevenue]);
    ws.addRow(['Total Transactions', summary.totalTransactions]);
    ws.addRow([]);
    ws.addRow(['Best Sellers']);
    const header = ws.addRow(['Product', 'Quantity Sold', 'Revenue']);
    header.font = { bold: true };
    summary.bestSellers.forEach((b) => ws.addRow([b.name, b.qty, b.revenue]));
    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 16;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${period}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

// Export report as PDF
exports.exportPDF = async (req, res, next) => {
  try {
    const period = req.params.period || 'daily';
    const { start, end } = rangeFor(period, req.query);
    const summary = await computeSummary(start, end);
    const purple = '#6B4E9E';
    const money = (n) => 'PHP ' + Number(n || 0).toFixed(2);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${period}.pdf"`);
    doc.pipe(res);

    doc.fillColor(purple).fontSize(22).text('Kafé Lumière', { align: 'center' });
    doc.fillColor('#000').fontSize(14).text(`Sales Report (${period})`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555').text(`From: ${start.toLocaleString()}`);
    doc.text(`To: ${end.toLocaleString()}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(12);
    doc.text(`Total Revenue: ${money(summary.totalRevenue)}`);
    doc.text(`Total Transactions: ${summary.totalTransactions}`);
    doc.moveDown();

    doc.fillColor(purple).fontSize(14).text('Best Sellers');
    doc.moveDown(0.3);
    doc.fillColor('#000').fontSize(11);
    summary.bestSellers.forEach((b, i) => {
      doc.text(`${i + 1}. ${b.name} - ${b.qty} sold (${money(b.revenue)})`);
    });
    if (!summary.bestSellers.length) doc.text('No sales in this period.');

    doc.end();
  } catch (err) {
    next(err);
  }
};

// Activity logs (security audit)
exports.logs = async (req, res, next) => {
  try {
    const { ActivityLog } = require('../models');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 15);
    const offset = (page - 1) * limit;
    const { count, rows } = await ActivityLog.findAndCountAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
    res.json({ data: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    next(err);
  }
};
