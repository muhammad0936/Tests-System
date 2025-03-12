const mongoose = require('mongoose');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');
const Teacher = require('../../models/Teacher');

// Create a new course
exports.createCourse = [
  body('name').notEmpty().withMessage('Course name is required'),
  body('description')
    .optional()
    .isString()
    .withMessage('Course description must be string'),
  body('material').isMongoId().withMessage('Invalid Material ID'),
  body('teacher').isMongoId().withMessage('Invalid Teacher ID'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const course = new Course(req.body);
      await course.save();
      const { _id, name, description, material, teacher } = course;
      res.status(201).json({
        course: { _id, name, description, material, teacher },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];

// Get courses with pagination and filters
exports.getCourses = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    // Destructure pagination and filter parameters from the query string
    const { page, limit, name, description, material, teacher } = req.query;
    const filter = {};

    // Filter based on course name using a case-insensitive regex
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    // Filter based on course description using a case-insensitive regex
    if (description) {
      filter.description = { $regex: description, $options: 'i' };
    }
    if (!material && !teacher)
      return res
        .status(400)
        .json({ message: 'material or teacher must be provided!' });
    // Filter using material ID if provided
    if (material) {
      // Convert the provided material string to an ObjectId to ensure proper matching
      const materialExists = await Material.exists({ _id: material });
      if (!materialExists)
        return res.status(400).json({ message: 'Material not found!' });
      filter.material = new mongoose.Types.ObjectId(material);
    }

    // Filter using teacher ID if provided
    if (teacher) {
      // Convert the provided teacher string to an ObjectId as well
      const teacherExists = await Teacher.exists({ _id: teacher });
      if (!teacherExists)
        return res.status(400).json({ message: 'Teacher not found!' });
      filter.teacher = new mongoose.Types.ObjectId(teacher);
    }

    const courses = await Course.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      populate: [
        { path: 'material', select: 'name' },
        { path: 'teacher', select: 'fname lname phone' },
      ],
      select: 'name description material teacher',
    });

    res.status(200).json(courses);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Server error' });
  }
};

// Delete a course by ID
exports.deleteCourse = [
  param('id').isMongoId().withMessage('Invalid Course ID'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const course = await Course.findByIdAndDelete(req.params.id);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      res.status(200).json({ message: 'Course deleted successfully' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];
