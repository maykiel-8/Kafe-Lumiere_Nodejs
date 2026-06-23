const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboard');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'cashier'));

router.get('/overview', ctrl.overview);
router.get('/charts', ctrl.charts);
router.get('/logs', authorize('admin'), ctrl.logs);
router.get('/report/:period', ctrl.report);
router.get('/report/:period/excel', ctrl.exportExcel);
router.get('/report/:period/pdf', ctrl.exportPDF);

module.exports = router;
