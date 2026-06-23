const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/item');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public browsing (menu) + autocomplete for homepage search
router.get('/', ctrl.list);
router.get('/autocomplete', ctrl.autocomplete);
router.get('/categories', ctrl.listCategories);
router.get('/sizes', ctrl.listSizes);
router.get('/addons', ctrl.listAddOns);
router.get('/:id', ctrl.getOne);

// Admin product management (route protection - admin only for writes)
router.post('/', authenticate, authorize('admin'), upload.single('image'), ctrl.create);
router.put('/:id', authenticate, authorize('admin'), upload.single('image'), ctrl.update);
router.patch('/:id/availability', authenticate, authorize('admin'), ctrl.setAvailability);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);

// Categories
router.post('/categories', authenticate, authorize('admin'), ctrl.createCategory);
router.put('/categories/:id', authenticate, authorize('admin'), ctrl.updateCategory);
router.delete('/categories/:id', authenticate, authorize('admin'), ctrl.deleteCategory);

// Sizes
router.post('/sizes', authenticate, authorize('admin'), ctrl.createSize);
router.delete('/sizes/:id', authenticate, authorize('admin'), ctrl.deleteSize);

// Add-ons
router.post('/addons', authenticate, authorize('admin'), ctrl.createAddOn);
router.delete('/addons/:id', authenticate, authorize('admin'), ctrl.deleteAddOn);

module.exports = router;
