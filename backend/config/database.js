const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'kafe_lumiere',
  process.env.DB_USER || 'kafe',
  process.env.DB_PASS || 'kafe_pass123',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    define: {
      underscored: false,
      freezeTableName: false,
    },
  }
);

module.exports = sequelize;
