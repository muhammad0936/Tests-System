const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const University = require('../../models/University'); // Adjust the path as necessary
const { body, param, validationResult } = require('express-validator');

// Create a new university
exports.createUniversity = [
  // Validate only complex fields
  body('icon.url').optional().isURL().withMessage('Icon URL must be valid'),
  body('icon.publicId')
    .optional()
    .isString()
    .withMessage('Icon public ID must be a string'),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const university = new University(req.body);
      await university.save();
      const { _id, name, icon = '' } = university;

      res.status(201).json({ university: { _id, name, icon } });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];

// Get all universities
exports.getUniversities = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { page, limit } = req.query;
    const universities = await University.paginate(
      {},
      { page: page || 1, limit: limit || 10, select: ' name icon' }
    );
    res.status(200).json(universities);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get a university by ID
exports.getUniversityById = [
  param('id').isMongoId().withMessage('Invalid university ID'),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const university = await University.findById(req.params.id).select(
        'name icon'
      );
      if (!university) {
        return res.status(404).json({ error: 'University not found' });
      }
      res.status(200).json(university);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },
];

// Update a university by ID
exports.updateUniversity = [
  param('id').isMongoId().withMessage('Invalid university ID'),
  body('icon.url').optional().isURL().withMessage('Icon URL must be valid'),
  body('icon.publicId')
    .optional()
    .isString()
    .withMessage('Icon public ID must be a string'),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const university = await University.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!university) {
        return res.status(404).json({ error: 'University not found' });
      }
      const { _id, name, icon = '' } = university;
      res.status(200).json({ university: { _id, name, icon } });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },
];

// Delete a university by ID
exports.deleteUniversity = [
  param('id').isMongoId().withMessage('Invalid university ID'),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const university = await University.findByIdAndDelete(req.params.id);
      if (!university) {
        return res.status(404).json({ error: 'University not found' });
      }

      res.status(200).json({ message: 'University deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },
];
