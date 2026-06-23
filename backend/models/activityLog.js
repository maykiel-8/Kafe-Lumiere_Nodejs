const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ActivityLog = sequelize.define(
    'ActivityLog',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      action: { type: DataTypes.STRING, allowNull: false },
      details: { type: DataTypes.STRING },
      ip: { type: DataTypes.STRING },
    },
    { tableName: 'activity_logs', timestamps: true, updatedAt: false }
  );
  return ActivityLog;
};
