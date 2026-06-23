const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AddOn = sequelize.define(
    'AddOn',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      available: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { tableName: 'addons', timestamps: true }
  );
  return AddOn;
};
