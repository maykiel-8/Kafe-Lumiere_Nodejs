const { verifyToken } = require('../utils/token');
const { User } = require('../models');

const SESSION_TIMEOUT_MIN = Number(process.env.SESSION_TIMEOUT_MINUTES) || 30;

// Authenticate request via Bearer token; also enforces inactive-session timeout.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const user = await User.findByPk(payload.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (!user.active) return res.status(403).json({ message: 'Account is deactivated' });
    if (user.token !== token) return res.status(401).json({ message: 'Session is no longer valid' });

    // Inactive session timeout
    if (user.lastActivity) {
      const idleMs = Date.now() - new Date(user.lastActivity).getTime();
      if (idleMs > SESSION_TIMEOUT_MIN * 60 * 1000) {
        user.token = null;
        await user.save();
        return res.status(401).json({ message: 'Session expired due to inactivity' });
      }
    }

    user.lastActivity = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Role-based access control (quiz 6 / route protection)
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
