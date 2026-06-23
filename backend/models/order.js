const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define(
    'Order',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      orderNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
      customerId: { type: DataTypes.INTEGER, allowNull: true },
      cashierId: { type: DataTypes.INTEGER, allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'preparing', 'ready', 'completed', 'cancelled'),
        defaultValue: 'pending',
      },
      subtotal: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      notes: { type: DataTypes.STRING },
    },
    { tableName: 'orders', timestamps: true }
  );
  return Order;
};
