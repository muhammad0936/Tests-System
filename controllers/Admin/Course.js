const mongoose = require('mongoose');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');
const College = require('../../models/College');
const University = require('../../models/University');
const Teacher = require('../../models/Teacher');
const { default: axios } = require('axios');

// Create a new course
exports.createCourse = [
  body('name').notEmpty().withMessage('يرجى إدخال اسم الدورة.'),
  body('description')
    .optional()
    .isString()
    .withMessage('وصف الدورة يجب أن يكون نصاً.'),
  body('material').isMongoId().withMessage('معرف المادة غير صحيح.'),
  body('teacher').isMongoId().withMessage('معرف المدرس غير صحيح.'),
  body('PromoVideo720.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الوصول للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('PromoVideo720.videoId')
    .optional()
    .isString()
    .withMessage('معرف الفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('PromoVideo720.libraryId')
    .optional()
    .isString()
    .withMessage('معرف المكتبة للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('PromoVideo720.downloadUrl')
    .optional()
    .isString()
    .withMessage('رابط التنزيل للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),

  body('PromoVideo480.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الوصول للفيديو الترويجي بجودة 480 يجب أن يكون نصاً.'),
  body('PromoVideo480.videoId')
    .optional()
    .isString()
    .withMessage('معرف الفيديو الترويجي بجودة 480 يجب أن يكون نصاً.'),
  body('PromoVideo480.libraryId')
    .optional()
    .isString()
    .withMessage('معرف المكتبة للفيديو الترويجي بجودة 480 يجب أن يكون نصاً.'),
  body('PromoVideo480.downloadUrl')
    .optional()
    .isString()
    .withMessage('رابط التنزيل للفيديو الترويجي بجودة 480 يجب أن يكون نصاً.'),

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
      year,
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

    if (college && !filter.material) {
      const loadedCollege = await College.findById(college);
      if (!loadedCollege) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الكلية.' });
      }
      const query = { college };
      if (year) {
        if (year > loadedCollege.numOfYears || year < 1) {
          return res.status(400).json({
            message: `الكلية تحتوي على ${loadedCollege.numOfYears} سنوات، والسنة المقدمة هي ${year}.`,
          });
        }
        query.year = year;
      }
      const materialsByCollege = await Material.find(query).select('_id');
      // if (!materialsByCollege.length) {
      //   if (!query.year)
      //     return res
      //       .status(400)
      //       .json({ message: 'لا توجد مواد مرتبطة بالكلية المحددة.' });
      //   else
      //     return res
      //       .status(400)
      //       .json({ message: 'لا توجد مواد مرتبطة بالسنةالأكاديمية المحددة.' });
      // }
      const materialIds = materialsByCollege.map((m) => m._id);
      filter.material = { $in: materialIds };
    }

    if (university && !filter.material) {
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
      filter.material = { $in: materialIds };
    }

    const courses = await Course.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      // populate: [
      //   { path: 'material', select: 'name' },
      //   { path: 'teacher', select: 'fname lname phone' },
      // ],
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
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const course = await Course.findByIdAndDelete(req.params.id);
      if (!course) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الدورة.' });
      }
      try {
        deletionResponse = await axios.delete(course.promoVideo720.accessUrl, {
          headers: {
            Accept: 'application/json',
            AccessKey: process.env.BUNNY_API_KEY,
          },
        });
      } catch (deleteError) {
        if (deleteError.response && deleteError.response.status === 404) {
          console.log('Video not found, skipping deletion.');
        } else {
          // Re-throw other errors
          throw deleteError;
        }
      }

      // }
      // console.log(deletionResponse?.data);
      res.status(200).json({ message: 'تم حذف الدورة بنجاح.' });
    } catch (err) {
      // console.error(err);
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];
