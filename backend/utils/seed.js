// Seeds the database with demo accounts, categories, sizes, add-ons, products,
// and a few sample orders/transactions so charts and reports have data.
require('dotenv').config();
const { sequelize, User, Category, Item, Size, AddOn, Order, OrderItem, Transaction } = require('../models');

async function seed() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  console.log('Seeding...');

  // Users
  const users = [
    { name: 'Admin Lumière', email: 'admin@kafe.test', password: 'admin123', role: 'admin' },
    { name: 'Cathy Cashier', email: 'cashier@kafe.test', password: 'cashier123', role: 'cashier' },
    { name: 'Carla Customer', email: 'customer@kafe.test', password: 'customer123', role: 'customer' },
  ];
  for (const u of users) {
    const [user, created] = await User.findOrCreate({ where: { email: u.email }, defaults: u });
    if (!created) {
      user.password = u.password; // re-hash via hook
      user.role = u.role;
      await user.save();
    }
  }

  // Categories
  const catNames = [
    ['Classic', 'Timeless milk tea favorites'],
    ['Fruit Tea', 'Refreshing fruit-based teas'],
    ['Premium', 'Premium specialty drinks'],
    ['Coffee', 'Coffee-based beverages'],
  ];
  const cats = {};
  for (const [name, description] of catNames) {
    const [c] = await Category.findOrCreate({ where: { name }, defaults: { description } });
    cats[name] = c;
  }

  // Sizes
  const sizes = [
    ['Regular', 0],
    ['Large', 20],
    ['Jumbo', 35],
  ];
  for (const [name, priceModifier] of sizes) {
    await Size.findOrCreate({ where: { name }, defaults: { priceModifier } });
  }

  // Add-ons
  const addons = [
    ['Pearls', 15],
    ['Pudding', 20],
    ['Cheese Foam', 25],
    ['Nata de Coco', 15],
    ['Extra Shot', 30],
  ];
  for (const [name, price] of addons) {
    await AddOn.findOrCreate({ where: { name }, defaults: { price } });
  }

  // Items
  const items = [
    ['Classic Milk Tea', 'Our signature black milk tea', 90, 'Classic'],
    ['Wintermelon Milk Tea', 'Sweet wintermelon goodness', 100, 'Classic'],
    ['Okinawa Milk Tea', 'Brown sugar roasted flavor', 105, 'Classic'],
    ['Strawberry Fruit Tea', 'Fresh strawberry green tea', 110, 'Fruit Tea'],
    ['Mango Fruit Tea', 'Tropical mango delight', 110, 'Fruit Tea'],
    ['Lychee Fruit Tea', 'Floral lychee infusion', 105, 'Fruit Tea'],
    ['Taro Premium', 'Creamy taro with real bits', 130, 'Premium'],
    ['Matcha Lavender Latte', 'Matcha with a hint of lavender', 140, 'Premium'],
    ['Iced Spanish Latte', 'Espresso with sweet milk', 120, 'Coffee'],
    ['Caramel Macchiato', 'Espresso, milk and caramel', 125, 'Coffee'],
  ];
  const itemRecords = {};
  for (const [name, description, basePrice, cat] of items) {
    const [it] = await Item.findOrCreate({
      where: { name },
      defaults: { description, basePrice, categoryId: cats[cat].id, available: true },
    });
    itemRecords[name] = it;
  }

  // Sample orders + transactions (spread across the last 7 days)
  const customer = await User.findOne({ where: { email: 'customer@kafe.test' } });
  const cashier = await User.findOne({ where: { email: 'cashier@kafe.test' } });
  const sizeRegular = await Size.findOne({ where: { name: 'Regular' } });
  const sizeLarge = await Size.findOne({ where: { name: 'Large' } });
  const pearls = await AddOn.findOne({ where: { name: 'Pearls' } });

  const existingOrders = await Order.count();
  if (existingOrders === 0) {
    const itemList = Object.values(itemRecords);
    for (let d = 6; d >= 0; d--) {
      const day = new Date();
      day.setDate(day.getDate() - d);
      day.setHours(12, 0, 0, 0);
      const ordersToday = 2 + (d % 3);
      for (let o = 0; o < ordersToday; o++) {
        const item = itemList[(d + o) % itemList.length];
        const size = o % 2 === 0 ? sizeLarge : sizeRegular;
        const qty = 1 + (o % 3);
        const addonsTotal = o % 2 === 0 ? Number(pearls.price) : 0;
        const unitPrice = Number(item.basePrice) + Number(size.priceModifier);
        const lineTotal = (unitPrice + addonsTotal) * qty;

        const order = await Order.create({
          orderNumber: `KL-SEED-${d}${o}-${Math.floor(1000 + Math.random() * 9000)}`,
          customerId: customer.id,
          cashierId: cashier.id,
          status: 'completed',
          subtotal: lineTotal,
          total: lineTotal,
          createdAt: day,
          updatedAt: day,
        });
        await OrderItem.create({
          orderId: order.id,
          itemId: item.id,
          itemName: item.name,
          sizeName: size.name,
          sugarLevel: '100%',
          iceLevel: 'Regular',
          quantity: qty,
          unitPrice,
          addonsTotal,
          lineTotal,
          addonsJson: JSON.stringify(addonsTotal ? [{ id: pearls.id, name: pearls.name, price: Number(pearls.price) }] : []),
          createdAt: day,
          updatedAt: day,
        });
        const paid = Math.ceil(lineTotal / 50) * 50;
        await Transaction.create({
          orderId: order.id,
          cashierId: cashier.id,
          paymentMethod: 'cash',
          amountDue: lineTotal,
          amountPaid: paid,
          change: paid - lineTotal,
          status: 'paid',
          createdAt: day,
          updatedAt: day,
        });
      }
    }
  }

  console.log('Seed complete.');
  console.log('Logins: admin@kafe.test/admin123, cashier@kafe.test/cashier123, customer@kafe.test/customer123');
  await sequelize.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
