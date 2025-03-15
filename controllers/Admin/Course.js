const mongoose = require('mongoose');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');
const College = require('../../models/College');
const University = require('../../models/University');
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

// controllers/courseController.js

exports.getCourses = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    // Destructure pagination and filter parameters from the query string
    const {
      page,
      limit,
      name,
      description,
      material,
      teacher,
      college,
      university,
    } = req.query;

    const filter = {};

    // Filter by course name (case-insensitive)
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    // Filter by course description (case-insensitive)
    if (description) {
      filter.description = { $regex: description, $options: 'i' };
    }

    // Filter using material ID if provided
    if (material) {
      const materialExists = await Material.exists({ _id: material });
      if (!materialExists) {
        return res.status(400).json({ message: 'Material not found!' });
      }
      filter.material = new mongoose.Types.ObjectId(material);
    }

    // Filter using teacher ID if provided
    if (teacher) {
      const teacherExists = await Teacher.exists({ _id: teacher });
      if (!teacherExists) {
        return res.status(400).json({ message: 'Teacher not found!' });
      }
      filter.teacher = new mongoose.Types.ObjectId(teacher);
    }

    /*
      Apply college filter by retrieving all materials belonging to the given college.
      If a material filter is already in place, ensure it belongs to the specified college.
    */
    if (college) {
      const collegeExists = await College.exists({ _id: college });
      if (!collegeExists) {
        return res.status(400).json({ message: 'College not found!' });
      }
      const materialsByCollege = await Material.find({ college }).select('_id');
      if (!materialsByCollege.length) {
        return res
          .status(400)
          .json({ message: 'No materials found for the provided college!' });
      }
      const materialIds = materialsByCollege.map((m) => m._id);
      if (filter.material) {
        // If a material filter was already provided, ensure its ID is within the list
        if (!materialIds.some((id) => id.equals(filter.material))) {
          return res.status(400).json({
            message:
              'The provided material does not belong to the specified college.',
          });
        }
      } else {
        filter.material = { $in: materialIds };
      }
    }

    /*
      Apply university filter by first getting all colleges belonging to the university
      and then getting all materials from those colleges.
      If a material filter already exists, ensure it is within the allowed materials.
    */
    if (university) {
      const universityExists = await University.exists({ _id: university });
      if (!universityExists) {
        return res.status(400).json({ message: 'University not found!' });
      }
      const colleges = await College.find({ university }).select('_id');
      if (!colleges.length) {
        return res
          .status(400)
          .json({ message: 'No colleges found for the specified university.' });
      }
      const collegeIds = colleges.map((c) => c._id);
      const materialsByUniversity = await Material.find({
        college: { $in: collegeIds },
      }).select('_id');
      if (!materialsByUniversity.length) {
        return res.status(400).json({
          message: 'No materials found for the specified university.',
        });
      }
      const materialIds = materialsByUniversity.map((m) => m._id);
      if (filter.material) {
        // If filter.material is defined as {$in: [...]}
        if (filter.material.$in) {
          const intersection = filter.material.$in.filter((id) =>
            materialIds.some((mId) => mId.equals(id))
          );
          if (!intersection.length) {
            return res.status(400).json({
              message:
                'No material found that meets the university filter criteria.',
            });
          }
          filter.material.$in = intersection;
        } else {
          // filter.material is a single ObjectId
          if (!materialIds.some((id) => id.equals(filter.material))) {
            return res.status(400).json({
              message:
                'The provided material does not belong to the specified university.',
            });
          }
        }
      } else {
        filter.material = { $in: materialIds };
      }
    }

    // Optional: If no filtering criteria on material, teacher, college, or university was provided,
    // you might choose to return an error or all courses. Adjust this as needed.
    // For this example, we allow listing courses with just a name/description filter.

    const courses = await Course.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      populate: [
        { path: 'material', select: 'name' },
        { path: 'teacher', select: 'fname lname phone' },
      ],
      select: 'name description material teacher',
    });

    return res.status(200).json(courses);
  } catch (err) {
    return res
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
