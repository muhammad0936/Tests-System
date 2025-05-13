const mongoose = require('mongoose');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');
const College = require('../../models/College');
const University = require('../../models/University');
const Teacher = require('../../models/Teacher');
const { default: axios } = require('axios');
const Video = require('../../models/Video');

// Create a new course
exports.createCourse = [
  body('name').notEmpty().withMessage('يرجى إدخال اسم الدورة.'),
  body('description')
    .optional()
    .isString()
    .withMessage('وصف الدورة يجب أن يكون نصاً.'),
  body('material').isMongoId().withMessage('معرف المادة غير صحيح.'),
  body('teacher').isMongoId().withMessage('معرف المدرس غير صحيح.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط وصول الأيقونة يجب أن يكون نصاً.'),
  // Correct the field names to use lowercase 'promoVideo720'
  body('promoVideo720.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الوصول للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('promoVideo720.videoId')
    .optional()
    .isString()
    .withMessage('معرف الفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('promoVideo720.libraryId')
    .optional()
    .isString()
    .withMessage('معرف المكتبة للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('promoVideo720.downloadUrl')
    .optional()
    .isString()
    .withMessage('رابط التنزيل للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),

  // Add validation for seekPoints
  body('seekPoints')
    .optional()
    .isArray()
    .withMessage('seekPoints يجب أن تكون مصفوفة.'),
  body('seekPoints.*.moment')
    .notEmpty()
    .isString()
    .withMessage('moment يجب أن يكون نصاً ولا يمكن أن يكون فارغاً.'),
  body('seekPoints.*.description')
    .notEmpty()
    .isString()
    .withMessage('الوصف يجب أن يكون نصاً ولا يمكن أن يكون فارغاً.'),

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
      if (req.body.promoVideo720) {
        const playDataUrl = `https://video.bunnycdn.com/library/${req.body.promoVideo720?.libraryId}/videos/${req.body.promoVideo720?.videoId}/play?expires=0`;
        const videoPlayData = await axios.get(playDataUrl, {
          // AccessKey: API_KEY,
        });
        req.body.promoVideo720.downloadUrl = videoPlayData?.data?.fallbackUrl;
      }
      const course = new Course(req.body);
      await course.save();
      const {
        _id,
        name,
        description,
        material,
        teacher,
        promoVideo720,
        seekPoints,
        icon,
      } = course;
      res.status(201).json({
        course: {
          _id,
          name,
          description,
          material,
          teacher,
          promoVideo720,
          seekPoints,
          icon,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || err.status || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

exports.updateCourse = [
  param('id')
    .isMongoId()
    .withMessage('يرجى إدخال معرف الدورة بشكل صحيح.'),
  body('name')
    .optional()
    .isString()
    .withMessage('اسم الدورة يجب أن يكون نصاً.'),
  body('description')
    .optional()
    .isString()
    .withMessage('الوصف يجب أن يكون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الأيقونة يجب أن يكون نصاً.'),
  body('seekPoints')
    .optional()
    .isArray()
    .withMessage('يجب أن تكون نقاط البحث مصفوفة.'),
  body('seekPoints.*.moment')
    .notEmpty()
    .isString()
    .withMessage('لحظة النقطة مطلوبة.'),
  body('seekPoints.*.description')
    .notEmpty()
    .isString()
    .withMessage('وصف النقطة مطلوب.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, icon, seekPoints } = req.body;
      const updateData = { name, description, icon, seekPoints };
      
      const course = await Course.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select('name description icon seekPoints material teacher');

      if (!course) {
        return res.status(404).json({ error: 'الدورة غير موجودة.' });
      }

      res.status(200).json(course);
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ في الخادم.' });
    }
  },
];
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
      select: 'name description material teacher icon promoVideo720 seekPoints',
    });

    return res.status(200).json(courses);
  } catch (err) {
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
  }
};

exports.deleteCourse = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الدورة بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Find course and associated videos first
      const course = await Course.findById(req.params.id);
      if (!course) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الدورة.' });
      }

      const videos = await Video.find({ course: course._id });

      // Collect all Bunny video information before deletion
      const bunnyDeletions = [];

      // Add promo video if exists
      if (course.promoVideo720?.videoId) {
        bunnyDeletions.push({
          type: 'promo',
          videoId: course.promoVideo720.videoId,
          libraryId: course.promoVideo720.libraryId,
        });
      }

      // Add course videos
      videos.forEach((video) => {
        if (video.video720?.videoId) {
          bunnyDeletions.push({
            type: 'course_video',
            videoId: video.video720.videoId,
            libraryId: video.video720.libraryId,
          });
        }
      });

      // Delete database entries first
      await Video.deleteMany({ course: course._id });
      await Course.findByIdAndDelete(req.params.id);

      // Process Bunny deletions and track results
      const deletionResults = [];
      for (const video of bunnyDeletions) {
        try {
          const response = await axios.delete(
            `https://video.bunnycdn.com/library/${video.libraryId}/videos/${video.videoId}`,
            {
              headers: {
                Accept: 'application/json',
                AccessKey: process.env.BUNNY_API_KEY,
              },
            }
          );

          deletionResults.push({
            type: video.type,
            videoId: video.videoId,
            status: 'success',
            data: response.data,
          });
        } catch (error) {
          deletionResults.push({
            type: video.type,
            videoId: video.videoId,
            status: 'error',
            error: error.response?.data || error.message,
          });
        }
      }

      res.status(200).json({
        message: 'تم حذف الدورة ومحتوياتها بنجاح.',
        details: {
          databaseDeleted: true,
          bunnyDeletions: deletionResults,
        },
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ أثناء معالجة الطلب.',
        details: {
          databaseDeleted: false,
          bunnyDeletions: [],
        },
      });
    }
  },
];
