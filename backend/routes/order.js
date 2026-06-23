const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/order');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Customers and staff can create orders
router.post('/', ctrl.create);
// Customers see their own; staff see all
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:id/receipt', ctrl.receipt);

// Staff-only
router.patch('/:id/status', authorize('admin', 'cashier'), ctrl.updateStatus);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
