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
  body('name').notEmpty().withMessage('يرجى إدخال اسم الدورة.'),
  body('description')
    .optional()
    .isString()
    .withMessage('وصف الدورة يجب أن يكون نصاً.'),
  body('material').isMongoId().withMessage('معرف المادة غير صحيح.'),
  body('teacher').isMongoId().withMessage('معرف المدرس غير صحيح.'),
  body('PromoVideo720.url')
    .optional()
    .isURL()
    .withMessage('رابط الفيديو الترويجي بجودة 720 يجب أن يكون صالحاً.'),
  body('PromoVideo720.publicId')
    .optional()
    .isString()
    .withMessage('المعرف العام للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('PromoVideo480.url')
    .optional()
    .isURL()
    .withMessage('رابط الفيديو الترويجي بجودة 480 يجب أن يكون صالحاً.'),
  body('PromoVideo480.publicId')
    .optional()
    .isString()
    .withMessage('المعرف العام للفيديو الترويجي بجودة 480 يجب أن يكون نصاً.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const teacherExists = await Teacher.exists({ _id: req.body.teacher });
      if (!teacherExists)
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المدرس.' });
      const materialExists = await Material.exists({ _id: req.body.material });
      if (!materialExists)
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      const course = new Course(req.body);
      await course.save();
      const {
        _id,
        name,
        description,
        material,
        teacher,
        promoVideo720,
        promoVideo480,
      } = course;
      res.status(201).json({
        course: {
          _id,
          name,
          description,
          material,
          teacher,
          promoVideo720,
          promoVideo480,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// controllers/courseController.js

exports.getCourses = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
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

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (description) {
      filter.description = { $regex: description, $options: 'i' };
    }

    if (material) {
      const materialExists = await Material.exists({ _id: material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }
      filter.material = new mongoose.Types.ObjectId(material);
    }

    if (teacher) {
      const teacherExists = await Teacher.exists({ _id: teacher });
      if (!teacherExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المدرس.' });
      }
      filter.teacher = new mongoose.Types.ObjectId(teacher);
    }

    if (college) {
      const collegeExists = await College.exists({ _id: college });
      if (!collegeExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الكلية.' });
      }
      const materialsByCollege = await Material.find({ college }).select('_id');
      if (!materialsByCollege.length) {
        return res
          .status(400)
          .json({ message: 'لا توجد مواد مرتبطة بالكلية المحددة.' });
      }
      const materialIds = materialsByCollege.map((m) => m._id);
      if (filter.material) {
        if (!materialIds.some((id) => id.equals(filter.material))) {
          return res.status(400).json({
            message: 'المادة المحددة لا تنتمي إلى الكلية المطلوبة.',
          });
        }
      } else {
        filter.material = { $in: materialIds };
      }
    }

    if (university) {
      const universityExists = await University.exists({ _id: university });
      if (!universityExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الجامعة.' });
      }
      const colleges = await College.find({ university }).select('_id');
      if (!colleges.length) {
        return res
          .status(400)
          .json({ message: 'لا توجد كليات مرتبطة بالجامعة المحددة.' });
      }
      const collegeIds = colleges.map((c) => c._id);
      const materialsByUniversity = await Material.find({
        college: { $in: collegeIds },
      }).select('_id');
      if (!materialsByUniversity.length) {
        return res.status(400).json({
          message: 'لا توجد مواد مرتبطة بالجامعة المحددة.',
        });
      }
      const materialIds = materialsByUniversity.map((m) => m._id);
      if (filter.material) {
        if (filter.material.$in) {
          const intersection = filter.material.$in.filter((id) =>
            materialIds.some((mId) => mId.equals(id))
          );
          if (!intersection.length) {
            return res.status(400).json({
              message: 'لا توجد مادة تتطابق مع معايير التصفية.',
            });
          }
          filter.material.$in = intersection;
        } else {
          if (!materialIds.some((id) => id.equals(filter.material))) {
            return res.status(400).json({
              message: 'المادة المحددة لا تنتمي إلى الجامعة المطلوبة.',
            });
          }
        }
      } else {
        filter.material = { $in: materialIds };
      }
    }

    const courses = await Course.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      populate: [
        { path: 'material', select: 'name' },
        { path: 'teacher', select: 'fname lname phone' },
      ],
      select: 'name description material teacher promoVideo720 promoVideo480',
    });

    return res.status(200).json(courses);
  } catch (err) {
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
  }
};

// Delete a course by ID
exports.deleteCourse = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الدورة بشكل صحيح.'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const course = await Course.findByIdAndDelete(req.params.id);
      if (!course) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الدورة.' });
      }
      res.status(200).json({ message: 'تم حذف الدورة بنجاح.' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];
