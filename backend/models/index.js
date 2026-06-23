const sequelize = require('../config/database');

const User = require('./user')(sequelize);
const Category = require('./category')(sequelize);
const Item = require('./item')(sequelize);
const Size = require('./size')(sequelize);
const AddOn = require('./addon')(sequelize);
const Order = require('./order')(sequelize);
const OrderItem = require('./orderItem')(sequelize);
const Transaction = require('./transaction')(sequelize);
const ActivityLog = require('./activityLog')(sequelize);

// Associations
Category.hasMany(Item, { foreignKey: 'categoryId', as: 'items' });
Item.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

User.hasMany(Order, { foreignKey: 'customerId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'customerId', as: 'customer' });
Order.belongsTo(User, { foreignKey: 'cashierId', as: 'cashier' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
OrderItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });

Order.hasOne(Transaction, { foreignKey: 'orderId', as: 'transaction' });
Transaction.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Transaction.belongsTo(User, { foreignKey: 'cashierId', as: 'cashier' });

User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'logs' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Category,
  Item,
  Size,
  AddOn,
  Order,
  OrderItem,
  Transaction,
  ActivityLog,
};
