const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/transaction');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Staff process payments and manage transactions
router.post('/pay', authorize('admin', 'cashier'), ctrl.pay);
router.get('/', authorize('admin', 'cashier'), ctrl.list);
router.get('/:id', authorize('admin', 'cashier'), ctrl.getOne);
router.put('/:id', authorize('admin', 'cashier'), ctrl.update);

module.exports = router;
