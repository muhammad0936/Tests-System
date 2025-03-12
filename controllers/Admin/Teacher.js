const Teacher = require('../../models/Teacher');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new teacher
exports.createTeacher = [
  body('fname').notEmpty().withMessage('First name is required'),
  body('lname').optional().isString().withMessage('Last name must be string'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const teacher = new Teacher(req.body);
      await teacher.save();
      const { _id, fname, lname, phone } = teacher;
      res.status(201).json({
        teacher: { _id, fname, lname, phone },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];

exports.getTeachers = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    // Destructure pagination and filter parameters from the query string
    const { page, limit, name, phone } = req.query;
    const filter = {};

    // Filter on teacher names (fname and lname) if 'name' is provided
    if (name) {
      filter.$or = [
        { fname: { $regex: name, $options: 'i' } },
        { lname: { $regex: name, $options: 'i' } },
      ];
    }

    // Filter on the phone number if 'phone' is provided
    if (phone) {
      filter.phone = { $regex: phone, $options: 'i' };
    }

    const teachers = await Teacher.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      select: 'fname lname phone', // return only the required fields
    });

    res.status(200).json(teachers);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Server error' });
  }
};

// Delete a teacher by ID
exports.deleteTeacher = [
  param('id').isMongoId().withMessage('Invalid Teacher ID'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const teacher = await Teacher.findByIdAndDelete(req.params.id);
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
      res.status(200).json({ message: 'Teacher deleted successfully' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];
