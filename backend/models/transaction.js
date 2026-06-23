const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define(
    'Transaction',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      orderId: { type: DataTypes.INTEGER, allowNull: false },
      cashierId: { type: DataTypes.INTEGER, allowNull: true },
      paymentMethod: { type: DataTypes.ENUM('cash'), defaultValue: 'cash' },
      amountDue: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      amountPaid: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      change: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.ENUM('paid', 'refunded'), defaultValue: 'paid' },
    },
    { tableName: 'transactions', timestamps: true }
  );
  return Transaction;
};
