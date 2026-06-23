const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Size = sequelize.define(
    'Size',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      // Amount added to an item base price for this size
      priceModifier: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    },
    { tableName: 'sizes', timestamps: true }
  );
  return Size;
};
