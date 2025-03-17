const College = require('../../models/College');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new material
exports.createMaterial = [
  body('name').notEmpty().withMessage('Material name is required'),
  body('year')
    .notEmpty()
    .withMessage('Year is required')
    .isNumeric()
    .withMessage('Year must be a number'),
  body('color').optional().isString().withMessage('Color must be string'),
  body('icon.url').optional().isURL().withMessage('Icon URL must be valid'),
  body('icon.publicId')
    .optional()
    .isString()
    .withMessage('Icon public ID must be a string'),
  body('college')
    .notEmpty()
    .withMessage('College ID is required')
    .isMongoId()
    .withMessage('Invalid College ID'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const college = await College.exists({ _id: college });
      if (!college)
        return res.status(400).json({ message: 'College not found!' });
      const material = new Material(req.body);
      await material.save();
      const { _id, name, year, color, icon } = material;
      res.status(201).json({
        material: { _id, name, year, color, icon },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];

// Get materials with filters
exports.getMaterials = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { page, limit, college, year, name } = req.query;
    const filter = {};
    if (!college) {
      req.status(400).json({ message: 'college is required!' });
    }
    const collegeExists = await College.exists({ _id: college });
    if (!collegeExists) {
      req.status(400).json({ message: 'college not found!' });
    }
    filter.college = college;
    if (year) {
      filter.year = Number(year);
    }
    if (name) {
      // optional: text search for material names (case-insensitive)
      filter.name = { $regex: name, $options: 'i' };
    }
    const materials = await Material.paginate(filter, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      populate: {
        path: 'college',
        select: 'name',
      },
      select: '-__v -createdAt -updatedAt',
    });
    res.status(200).json(materials);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Server error' });
  }
};

// Delete a material by ID
exports.deleteMaterial = [
  param('id').isMongoId().withMessage('Invalid Material ID'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const material = await Material.findByIdAndDelete(req.params.id);
      if (!material) {
        return res.status(404).json({ error: 'Material not found' });
      }
      res.status(200).json({ message: 'Material deleted successfully' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];
