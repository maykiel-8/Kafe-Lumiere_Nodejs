const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Item = sequelize.define(
    'Item',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT },
      basePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      categoryId: { type: DataTypes.INTEGER, allowNull: true },
      image: { type: DataTypes.STRING },
      available: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { tableName: 'items', timestamps: true }
  );
  return Item;
};
