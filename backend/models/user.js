const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password: { type: DataTypes.STRING, allowNull: false },
      role: {
        type: DataTypes.ENUM('admin', 'cashier', 'customer'),
        allowNull: false,
        defaultValue: 'customer',
      },
      phone: { type: DataTypes.STRING },
      address: { type: DataTypes.STRING },
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      // Authentication token saved on the users table (mp5 requirement)
      token: { type: DataTypes.TEXT },
      lastActivity: { type: DataTypes.DATE },
    },
    {
      tableName: 'users',
      timestamps: true,
      hooks: {
        beforeCreate: async (user) => {
          if (user.password) user.password = await bcrypt.hash(user.password, 10);
        },
        beforeUpdate: async (user) => {
          if (user.changed('password')) {
            user.password = await bcrypt.hash(user.password, 10);
          }
        },
      },
    }
  );

  User.prototype.validatePassword = function (plain) {
    return bcrypt.compare(plain, this.password);
  };

  User.prototype.toSafeJSON = function () {
    const obj = this.toJSON();
    delete obj.password;
    delete obj.token;
    return obj;
  };

  return User;
};
