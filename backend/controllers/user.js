const { Op } = require('sequelize');
const { User } = require('../models');
const { generateToken } = require('../utils/token');
const { logActivity } = require('../utils/logger');

// Customer self-registration
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ message: 'Email is already registered' });

    const user = await User.create({
      name,
      email,
      password,
      phone,
      address,
      role: 'customer',
    });
    await logActivity(user.id, 'register', `New customer registered: ${email}`, req);
    res.status(201).json({ message: 'Registration successful', user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

// Login - generate token and save it on users table (mp5)
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.active) return res.status(403).json({ message: 'Account is deactivated' });

    const valid = await user.validatePassword(password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user);
    user.token = token;
    user.lastActivity = new Date();
    await user.save();

    await logActivity(user.id, 'login', `User logged in: ${email}`, req);
    res.json({ message: 'Login successful', token, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    req.user.token = null;
    await req.user.save();
    await logActivity(req.user.id, 'logout', 'User logged out', req);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
};

// Update own profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    if (name !== undefined) req.user.name = name;
    if (phone !== undefined) req.user.phone = phone;
    if (address !== undefined) req.user.address = address;
    await req.user.save();
    await logActivity(req.user.id, 'update_profile', 'Profile updated', req);
    res.json({ message: 'Profile updated', user: req.user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

// Update own password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'New password is required' });
    const valid = await req.user.validatePassword(currentPassword || '');
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
    req.user.password = newPassword;
    await req.user.save();
    await logActivity(req.user.id, 'change_password', 'Password changed', req);
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
};

// Customer self-deactivation
exports.deactivateSelf = async (req, res, next) => {
  try {
    req.user.active = false;
    req.user.token = null;
    await req.user.save();
    await logActivity(req.user.id, 'deactivate_self', 'User deactivated own account', req);
    res.json({ message: 'Your account has been deactivated' });
  } catch (err) {
    next(err);
  }
};

// ---- Admin user management ----

// List users with pagination + search (datatable / infinite scroll friendly)
exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const role = req.query.role;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) where.role = role;

    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password', 'token'] },
    });

    res.json({
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'token'] },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// Admin creates cashier/admin/customer accounts
exports.create = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ message: 'Email is already registered' });
    const user = await User.create({
      name,
      email,
      password,
      role: ['admin', 'cashier', 'customer'].includes(role) ? role : 'customer',
      phone,
      address,
    });
    await logActivity(req.user.id, 'create_user', `Created ${user.role}: ${email}`, req);
    res.status(201).json({ message: 'User created', user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { name, email, role, phone, address, password } = req.body;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role && ['admin', 'cashier', 'customer'].includes(role)) user.role = role;
    if (password) user.password = password;
    await user.save();
    await logActivity(req.user.id, 'update_user', `Updated user #${user.id}`, req);
    res.json({ message: 'User updated', user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

// Admin can update role of user
exports.updateRole = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { role } = req.body;
    if (!['admin', 'cashier', 'customer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    user.role = role;
    await user.save();
    await logActivity(req.user.id, 'update_role', `User #${user.id} role -> ${role}`, req);
    res.json({ message: 'Role updated', user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

// Admin can (de)activate users
exports.setActive = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.active = !!req.body.active;
    if (!user.active) user.token = null; // force logout
    await user.save();
    await logActivity(
      req.user.id,
      'set_active',
      `User #${user.id} active=${user.active}`,
      req
    );
    res.json({ message: `User ${user.active ? 'activated' : 'deactivated'}`, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    await user.destroy();
    await logActivity(req.user.id, 'delete_user', `Deleted user #${req.params.id}`, req);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

// Autocomplete (quiz 5) - customers search
exports.autocomplete = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ data: [] });
    const rows = await User.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
        ],
      },
      limit: 8,
      attributes: ['id', 'name', 'email', 'role'],
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};
