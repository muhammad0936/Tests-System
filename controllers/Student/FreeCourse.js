const { query, validationResult } = require('express-validator');
const Student = require('../../models/Student');
const Course = require('../../models/Course');
const Video = require('../../models/Video');
const College = require('../../models/College');
const Material = require('../../models/Material');
const mongoosePaginate = require('mongoose-paginate-v2');

exports.getFreeCourses = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون رقم الصفحة عدداً صحيحاً موجباً')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون الحد الأقصى للعناصر عدداً صحيحاً موجباً')
    .toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { page, limit } = req.query;
      const student = await Student.findById(req.userId);

      // Validate student college
      if (!student.college) {
        return res.status(400).json({ error: 'هذا الطالب لا يملك معرف كلية!' });
      }

      // Get college info
      const college = await College.findById(student.college);
      if (!college) {
        return res.status(400).json({ error: 'معرف الكلية غير صالح!' });
      }

      // Validate study year
      if (
        !student.year ||
        student.year > college.numOfYears ||
        student.year < 1
      ) {
        return res.status(400).json({
          error: `السنة الدراسية يجب أن تكون بين 1 و ${college.numOfYears}`,
        });
      }

      // Get materials for student's college/year
      const materials = await Material.find({
        college: student.college,
        year: student.year,
      }).select('_id');

      // Get courses for these materials
      const courses = await Course.paginate(
        { material: { $in: materials.map((m) => m._id) } },
        {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
          populate: [
            { path: 'material', select: 'name' },
            { path: 'teacher', select: 'fname lname' },
          ],
          select: '-__v -createdAt -updatedAt',
        }
      );

      res.status(200).json(courses);
    } catch (err) {
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ في الخادم.',
      });
    }
  },
];

exports.getFreeVideos = [
  query('course')
    .isMongoId()
    .withMessage('معرف الدورة يجب أن يكون معرفاً صالحاً'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون رقم الصفحة عدداً صحيحاً موجباً')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون الحد الأقصى للعناصر عدداً صحيحاً موجباً')
    .toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { page, limit, course } = req.query;
      const student = await Student.findById(req.userId);

      // Validate student college
      if (!student.college) {
        return res.status(400).json({ error: 'هذا الطالب لا يملك معرف كلية!' });
      }

      // Get college info
      const college = await College.findById(student.college);
      if (!college) {
        return res.status(400).json({ error: 'معرف الكلية غير صالح!' });
      }

      // Validate study year
      if (
        !student.year ||
        student.year > college.numOfYears ||
        student.year < 1
      ) {
        return res.status(400).json({
          error: `السنة الدراسية يجب أن تكون بين 1 و ${college.numOfYears}`,
        });
      }

      // Check course exists and belongs to student's college/year
      const validCourse = await Course.findOne({
        _id: course,
      }).populate({
        path: 'material',
        match: {
          college: student.college,
          year: student.year,
        },
      });

      if (!validCourse?.material) {
        return res.status(403).json({
          error: 'هذه الدورة غير متاحة لطلاب كليتك وسنتك الدراسية',
        });
      }

      // Get videos for the course
      const videos = await Video.paginate(
        { course },
        {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
          select: '-video720 -video480 -__v -createdAt -updatedAt -course',
        }
      );

      res.status(200).json(videos);
    } catch (err) {
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ في الخادم.',
      });
    }
  },
];
