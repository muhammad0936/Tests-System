const FreeQuestion = require('../../models/FreeQuestion');
const Question = require('../../models/Question');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

exports.copyQuestionsToFree = [
  body('numOfQuestions')
    .isInt({ min: 1 })
    .withMessage('يرجى إدخال عدد الأسئلة كرقم صحيح أكبر من صفر.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { numOfQuestions } = req.body;
      let totalCopied = 0;

      // حذف جميع الأسئلة المجانية الحالية
      await FreeQuestion.deleteMany({});

      // جلب جميع المواد التي تحتوي على أسئلة
      const materials = await Material.find({
        _id: { $in: await Question.distinct('material') },
      });

      // معالجة كل مادة
      for (const material of materials) {
        // اختيار أسئلة عشوائية من المادة الحالية
        const questions = await Question.aggregate([
          { $match: { material: material._id } },
          { $sample: { size: numOfQuestions } },
          { $project: { __v: 0, createdAt: 0, updatedAt: 0 } },
        ]);

        if (questions.length === 0) continue;

        // إدخال الأسئلة في مجموعة الأسئلة المجانية
        const result = await FreeQuestion.insertMany(questions);
        totalCopied += result.length;
      }

      res.status(200).json({
        message: `تم استبدال جميع الأسئلة المجانية بنجاح وإضافة ${totalCopied} سؤال جديد.`,
        totalCopied,
        materialsProcessed: materials.length,
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];
