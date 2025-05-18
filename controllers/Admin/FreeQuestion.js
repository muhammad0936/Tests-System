const FreeQuestionGroup = require('../../models/FreeQuestionGroup');
const QuestionGroup = require('../../models/QuestionGroup');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

exports.copyQuestionsToFree = [
  body('numOfGroups')
    .isInt({ min: 1 })
    .withMessage('يرجى إدخال عدد المجموعات كرقم صحيح أكبر من صفر.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { numOfGroups } = req.body;

      // 1. Clear existing free groups
      await FreeQuestionGroup.deleteMany({});

      // 2. Find and sample groups in single query
      const groups = await QuestionGroup.aggregate([
        { $match: { $expr: { $eq: [{ $size: "$questions" }, 1] } } },
        { $sample: { size: numOfGroups } },
        { $project: { 
          material: 1,
          paragraph: 1,
          images: 1,
          prevYearTitle: 1,
          materialSection: 1,
          questions: {
            $map: {
              input: "$questions",
              as: "q",
              in: {
                isEnglish: "$$q.isEnglish",
                text: "$$q.text",
                isMultipleChoice: "$$q.isMultipleChoice",
                choices: "$$q.choices",
                information: "$$q.information",
                infoImages: "$$q.infoImages"
              }
            }
          }
        }}
      ]);

      if (!groups.length) {
        return res.status(404).json({
          message: 'لا توجد مجموعات أسئلة تحتوي على سؤال واحد',
          totalCopied: 0
        });
      }

      // 3. Prepare for insertion (with new choice IDs)
      const processedGroups = groups.map(group => ({
        ...group,
        questions: group.questions.map(question => ({
          ...question,
          choices: question.choices.map(choice => ({
            ...choice,
            _id: new mongoose.Types.ObjectId()
          }))
        }))
      }));

      // 4. Bulk insert
      const result = await FreeQuestionGroup.insertMany(processedGroups);

      res.status(200).json({
        message: `تم نسخ ${result.length} مجموعة بنجاح`,
        totalCopied: result.length
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ غير متوقع',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }
];