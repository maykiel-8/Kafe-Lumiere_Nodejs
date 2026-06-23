const PDFDocument = require('pdfkit');

// Builds a receipt PDF (with full order details) and returns a Buffer.
function buildReceiptPDF(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A5', margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const purple = '#6B4E9E';
      const money = (n) => 'PHP ' + Number(n || 0).toFixed(2);

      // Header
      doc.fillColor(purple).fontSize(22).text('Kafé Lumière', { align: 'center' });
      doc.fillColor('#555').fontSize(10).text('Milk Tea Shop', { align: 'center' });
      doc.moveDown(0.5);
      doc.fillColor('#000').fontSize(12).text('OFFICIAL RECEIPT', { align: 'center' });
      doc.moveDown(0.5);

      doc.fontSize(9).fillColor('#333');
      doc.text(`Order No: ${order.orderNumber}`);
      doc.text(`Date: ${new Date(order.createdAt || Date.now()).toLocaleString()}`);
      if (order.customer) doc.text(`Customer: ${order.customer.name}`);
      if (order.cashier) doc.text(`Cashier: ${order.cashier.name}`);
      doc.text(`Status: ${order.status}`);

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(380, doc.y).strokeColor(purple).stroke();
      doc.moveDown(0.5);

      // Items
      (order.items || []).forEach((it) => {
        const addons = it.addonsJson ? JSON.parse(it.addonsJson) : [];
        doc
          .fillColor('#000')
          .fontSize(10)
          .text(`${it.quantity} x ${it.itemName} (${it.sizeName || 'Regular'})`, { continued: true })
          .text(money(it.lineTotal), { align: 'right' });
        doc
          .fillColor('#777')
          .fontSize(8)
          .text(`   Sugar: ${it.sugarLevel}, Ice: ${it.iceLevel}`);
        if (addons.length) {
          doc.text(`   Add-ons: ${addons.map((a) => a.name).join(', ')}`);
        }
      });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(380, doc.y).strokeColor('#ccc').stroke();
      doc.moveDown(0.5);

      doc.fillColor('#000').fontSize(10);
      doc.text('Subtotal:', { continued: true }).text(money(order.subtotal), { align: 'right' });
      doc
        .fontSize(12)
        .fillColor(purple)
        .text('TOTAL:', { continued: true })
        .text(money(order.total), { align: 'right' });

      if (order.transaction) {
        doc.moveDown(0.3).fillColor('#000').fontSize(10);
        doc.text('Cash:', { continued: true }).text(money(order.transaction.amountPaid), { align: 'right' });
        doc.text('Change:', { continued: true }).text(money(order.transaction.change), { align: 'right' });
      }

      doc.moveDown(1);
      doc.fillColor('#777').fontSize(9).text('Thank you for choosing Kafé Lumière!', { align: 'center' });
      doc.text('Lumière in every sip.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildReceiptPDF };
