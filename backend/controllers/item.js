const { Op } = require('sequelize');
const { Item, Category, Size, AddOn } = require('../models');
const { logActivity } = require('../utils/logger');

// List items with search + pagination (DataTables / infinite scroll friendly)
exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 9);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const categoryId = req.query.categoryId;
    const availableOnly = req.query.availableOnly === 'true';

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (availableOnly) where.available = true;

    const { count, rows } = await Item.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category' }],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
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
    const item = await Item.findByPk(req.params.id, {
      include: [{ model: Category, as: 'category' }],
    });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description, basePrice, categoryId, available } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const item = await Item.create({
      name,
      description,
      basePrice: basePrice || 0,
      categoryId: categoryId || null,
      available: available === undefined ? true : available === 'true' || available === true,
      image: req.file ? `/uploads/${req.file.filename}` : null,
    });
    await logActivity(req.user.id, 'create_item', `Created product: ${name}`, req);
    res.status(201).json({ message: 'Item created', item });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    const { name, description, basePrice, categoryId, available } = req.body;
    if (name !== undefined) item.name = name;
    if (description !== undefined) item.description = description;
    if (basePrice !== undefined) item.basePrice = basePrice;
    if (categoryId !== undefined) item.categoryId = categoryId || null;
    if (available !== undefined) item.available = available === 'true' || available === true;
    if (req.file) item.image = `/uploads/${req.file.filename}`;
    await item.save();
    await logActivity(req.user.id, 'update_item', `Updated product #${item.id}`, req);
    res.json({ message: 'Item updated', item });
  } catch (err) {
    next(err);
  }
};

exports.setAvailability = async (req, res, next) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    item.available = !!req.body.available;
    await item.save();
    await logActivity(req.user.id, 'set_availability', `Item #${item.id} available=${item.available}`, req);
    res.json({ message: 'Availability updated', item });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    await item.destroy();
    await logActivity(req.user.id, 'delete_item', `Deleted product #${req.params.id}`, req);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    next(err);
  }
};

// Autocomplete for homepage search (quiz 5)
exports.autocomplete = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ data: [] });
    const rows = await Item.findAll({
      where: {
        available: true,
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } },
        ],
      },
      limit: 8,
      attributes: ['id', 'name', 'basePrice', 'image'],
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

// ---- Categories ----
exports.listCategories = async (req, res, next) => {
  try {
    const rows = await Category.findAll({ order: [['name', 'ASC']] });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const cat = await Category.create({ name, description });
    await logActivity(req.user.id, 'create_category', `Created category: ${name}`, req);
    res.status(201).json({ message: 'Category created', category: cat });
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    const { name, description } = req.body;
    if (name !== undefined) cat.name = name;
    if (description !== undefined) cat.description = description;
    await cat.save();
    res.json({ message: 'Category updated', category: cat });
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const cat = await Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    await cat.destroy();
    res.json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};

// ---- Sizes ----
exports.listSizes = async (req, res, next) => {
  try {
    const rows = await Size.findAll({ order: [['priceModifier', 'ASC']] });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

exports.createSize = async (req, res, next) => {
  try {
    const { name, priceModifier } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const size = await Size.create({ name, priceModifier: priceModifier || 0 });
    res.status(201).json({ message: 'Size created', size });
  } catch (err) {
    next(err);
  }
};

exports.deleteSize = async (req, res, next) => {
  try {
    const size = await Size.findByPk(req.params.id);
    if (!size) return res.status(404).json({ message: 'Size not found' });
    await size.destroy();
    res.json({ message: 'Size deleted' });
  } catch (err) {
    next(err);
  }
};

// ---- Add-ons ----
exports.listAddOns = async (req, res, next) => {
  try {
    const rows = await AddOn.findAll({ order: [['name', 'ASC']] });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

exports.createAddOn = async (req, res, next) => {
  try {
    const { name, price } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const addon = await AddOn.create({ name, price: price || 0 });
    res.status(201).json({ message: 'Add-on created', addon });
  } catch (err) {
    next(err);
  }
};

exports.deleteAddOn = async (req, res, next) => {
  try {
    const addon = await AddOn.findByPk(req.params.id);
    if (!addon) return res.status(404).json({ message: 'Add-on not found' });
    await addon.destroy();
    res.json({ message: 'Add-on deleted' });
  } catch (err) {
    next(err);
  }
};
