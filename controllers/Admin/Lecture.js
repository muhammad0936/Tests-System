const mongoose = require('mongoose');
const Lecture = require('../../models/Lecture');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');

// إنشاء محاضرة جديدة
exports.createLecture = [
  body('num')
    .isInt({ min: 1 })
    .withMessage('يجب إدخال رقم محاضرة صحيح أكبر من الصفر.'),
  body('material').isMongoId().withMessage('معرف المادة غير صحيح.'),
  body('file.filename')
    .optional()
    .isString()
    .withMessage('اسم الملف يجب أن يكون نصاً.'),
  body('file.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الملف يجب أن يكون نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // التحقق من وجود المادة
      const materialExists = await Material.exists({ _id: req.body.material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }

      // إنشاء المحاضرة
      const lecture = new Lecture({
        num: req.body.num,
        material: req.body.material,
        file: req.body.file || {},
      });

      await lecture.save();

      res.status(201).json({
        _id: lecture._id,
        num: lecture.num,
        material: lecture.material,
        file: lecture.file,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          error: `المحاضرة رقم ${req.body.num} موجودة مسبقاً في هذه المادة`,
        });
      }
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء إنشاء المحاضرة.' });
    }
  },
];

// controllers/lectureController.js

exports.getLecturesByMaterial = [
  param('materialId').isMongoId().withMessage('معرف المادة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // التحقق من وجود المادة
      const materialExists = await Material.exists({
        _id: req.params.materialId,
      });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }
      const lectures = await Lecture.find({ material: req.params.materialId })
        .select('num material file')
        .sort({ num: 1 })
        .lean();

      res.status(200).json({
        lectures,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء استرجاع المحاضرات.',
      });
    }
  },
];
// حذف محاضرة
exports.deleteLecture = [
  param('id').isMongoId().withMessage('معرف المحاضرة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // البحث عن المحاضرة
      const lecture = await Lecture.findById(req.params.id);
      if (!lecture) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على المحاضرة.' });
      }

      // حذف المحاضرة
      await Lecture.findByIdAndDelete(req.params.id);

      res.status(200).json({
        message: 'تم حذف المحاضرة بنجاح.',
        deletedLecture: {
          _id: lecture._id,
          num: lecture.num,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء حذف المحاضرة.' });
    }
  },
];
