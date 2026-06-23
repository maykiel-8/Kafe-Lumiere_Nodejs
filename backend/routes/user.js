const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/user');
const { authenticate, authorize } = require('../middleware/auth');

// Public
router.post('/register', ctrl.register);
router.post('/login', ctrl.login);

// Authenticated (self-service)
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.put('/me', authenticate, ctrl.updateProfile);
router.put('/me/password', authenticate, ctrl.changePassword);
router.put('/me/deactivate', authenticate, ctrl.deactivateSelf);

// Admin user management
router.get('/', authenticate, authorize('admin'), ctrl.list);
router.get('/autocomplete', authenticate, authorize('admin', 'cashier'), ctrl.autocomplete);
router.get('/:id', authenticate, authorize('admin'), ctrl.getOne);
router.post('/', authenticate, authorize('admin'), ctrl.create);
router.put('/:id', authenticate, authorize('admin'), ctrl.update);
router.patch('/:id/role', authenticate, authorize('admin'), ctrl.updateRole);
router.patch('/:id/active', authenticate, authorize('admin'), ctrl.setActive);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);

module.exports = router;
