const { ActivityLog } = require('../models');

// System security: log user activities (login, order creation, payment, product updates)
async function logActivity(userId, action, details, req) {
  try {
    await ActivityLog.create({
      userId: userId || null,
      action,
      details: details ? String(details).slice(0, 255) : null,
      ip: req ? req.ip : null,
    });
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

module.exports = { logActivity };
