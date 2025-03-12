const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const College = require('../../models/College'); // Adjust the path if necessary
const { body, param, validationResult } = require('express-validator');
const University = require('../../models/University');

// Create a new college
exports.createCollege = [
  body('name').notEmpty().withMessage('College name is required'),
  body('university')
    .notEmpty()
    .withMessage('University ID is required')
    .isMongoId()
    .withMessage('Invalid University ID'),
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
      const college = new College(req.body);
      await college.save();
      const { _id, name, icon, university } = college;

      res.status(201).json({ college: { _id, name, icon, university } });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];

// Get all colleges
exports.getColleges = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { page, limit, university } = req.query;

    const filter = {};
    if (!university) {
      return res.status(400).json({ message: 'university is required!' });
    }
    const universityExists = await University.exists({ _id: university });
    if (!universityExists) {
      return res.status(400).json({ message: 'University not found!' });
    }
    filter.university = university;
    const colleges = await College.paginate(filter, {
      page: page || 1,
      limit: limit || 10,
      select: 'name icon university',
      populate: { path: 'university', select: 'name' }, // Populate university details
    });

    res.status(200).json(colleges);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// Get a college by ID
exports.getCollegeById = [
  param('id').isMongoId().withMessage('Invalid College ID'),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const college = await College.findById(req.params.id)
        .select('name icon university')
        .populate({ path: 'university', select: 'name' }); // Populate university details
      if (!college) {
        return res.status(404).json({ error: 'College not found' });
      }
      res.status(200).json(college);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },
];

// Update a college by ID
exports.updateCollege = [
  param('id').isMongoId().withMessage('Invalid College ID'),
  body('name').optional().notEmpty().withMessage('College name is required'),
  body('university')
    .optional()
    .isMongoId()
    .withMessage('Invalid University ID'),
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
      const college = await College.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!college) {
        return res.status(404).json({ error: 'College not found' });
      }
      const { _id, name, icon, university } = college;
      res.status(200).json({ college: { _id, name, icon, university } });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },
];

// Delete a college by ID
exports.deleteCollege = [
  param('id').isMongoId().withMessage('Invalid College ID'),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const college = await College.findByIdAndDelete(req.params.id);
      if (!college) {
        return res.status(404).json({ error: 'College not found' });
      }
      res.status(200).json({ message: 'College deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },
];
