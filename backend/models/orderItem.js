const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderItem = sequelize.define(
    'OrderItem',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      orderId: { type: DataTypes.INTEGER, allowNull: false },
      itemId: { type: DataTypes.INTEGER, allowNull: true },
      itemName: { type: DataTypes.STRING, allowNull: false },
      sizeName: { type: DataTypes.STRING },
      sugarLevel: { type: DataTypes.STRING, defaultValue: '100%' },
      iceLevel: { type: DataTypes.STRING, defaultValue: 'Regular' },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      addonsTotal: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      lineTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      // JSON string of selected add-ons: [{name, price}]
      addonsJson: { type: DataTypes.TEXT },
    },
    { tableName: 'order_items', timestamps: true }
  );
  return OrderItem;
};
