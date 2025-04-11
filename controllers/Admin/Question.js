const QuestionGroup = require('../../models/QuestionGroup');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');
const { default: mongoose } = require('mongoose');
const { default: axios } = require('axios');

exports.createQuestionGroup = [
  body('paragraph')
    .optional()
    .isString()
    .withMessage('يجب أن تكون الفقرة نصية.'),

  body('image.filename')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('image.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),

  body('material').notEmpty().isMongoId().withMessage('معرف المادة غير صالح.'),

  body('questions')
    .isArray({ min: 1 })
    .withMessage('يجب إدخال مجموعة من الأسئلة.'),

  body('questions').custom((questions) => {
    questions.forEach((question, index) => {
      // Validate question text
      if (!question.text?.trim()) {
        throw new Error(`نص السؤال مطلوب للسؤال رقم ${index + 1}.`);
      }

      // All questions must have at least 2 choices
      if (!question.choices?.length || question.choices.length < 2) {
        throw new Error(
          `يجب أن يحتوي السؤال رقم ${index + 1} على خيارين على الأقل.`
        );
      }

      // Validate choices structure
      question.choices.forEach((choice, choiceIndex) => {
        if (!choice.text?.trim()) {
          throw new Error(
            `نص الاختيار مطلوب في السؤال رقم ${index + 1}, الاختيار رقم ${
              choiceIndex + 1
            }.`
          );
        }
      });

      // Validate correct answers based on isMultipleChoice
      const correctChoices = question.choices.filter((c) => c.isCorrect).length;
      if (correctChoices < 1) {
        throw new Error(
          `يجب تحديد إجابة صحيحة واحدة على الأقل في السؤال رقم ${index + 1}.`
        );
      }
    });
    return true;
  }),

  // Question validations
  body('questions.*.text').notEmpty().withMessage('نص السؤال مطلوب.'),
  body('questions.*.isMultipleChoice')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isMultipleChoice قيمة منطقية.'),
  body('questions.*.isEnglish')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isEnglish قيمة منطقية.'),
  body('questions.*.choices')
    .isArray({ min: 2 })
    .withMessage('الخيارات يجب أن تكون قائمة تحتوي على خيارين على الأقل.'),
  body('questions.*.choices.*.text')
    .notEmpty()
    .withMessage('نص الاختيار مطلوب.'),
  body('questions.*.choices.*.isCorrect')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isCorrect قيمة منطقية.'),
  body('questions.*.information')
    .optional()
    .isString()
    .withMessage('يجب أن تكون المعلومات نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const groupData = req.body;
      // Verify material exists
      const materialExists = await Material.exists({ _id: groupData.material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، المادة المحددة غير موجودة.' });
      }

      const newGroup = new QuestionGroup(groupData);
      await newGroup.save();

      res.status(201).json({
        message: 'تم إنشاء مجموعة الأسئلة بنجاح.',
        group: newGroup,
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

exports.getQuestionGroups = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { limit = 10, page = 1, material } = req.query;

    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }

    const filter = { material: new mongoose.Types.ObjectId(material) };
    const pageSize = parseInt(limit);
    const currentPage = parseInt(page);

    const [groups, totalGroups] = await Promise.all([
      QuestionGroup.find(filter)
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),
      QuestionGroup.countDocuments(filter),
    ]);

    res.status(200).json({
      docs: groups,
      totalDocs: totalGroups,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalGroups / pageSize),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

exports.deleteQuestionGroup = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف السؤال بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const questionGroupId = req.params.id;
      const group = await QuestionGroup.findById(questionGroupId);

      if (!group) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على السؤال.' });
      }

      // Capture file info before any deletion
      const bunnyDeletions = [];
      if (group.image?.accessUrl) {
        bunnyDeletions.push({
          type: 'question_image',
          accessUrl: group.image.accessUrl,
        });
      }

      // Delete the entire question group
      await QuestionGroup.deleteOne({ _id: questionGroupId });

      // Process file deletions
      const deletionResults = [];
      for (const file of bunnyDeletions) {
        try {
          await axios.delete(file.accessUrl, {
            headers: {
              Accept: 'application/json',
              AccessKey: process.env.BUNNY_STORAGE_API_KEY,
            },
          });
          deletionResults.push({ type: file.type, status: 'success' });
        } catch (error) {
          deletionResults.push({
            type: file.type,
            status: 'error',
            error: error.response?.data || error.message,
          });
        }
      }

      res.status(200).json({
        message: 'تم حذف مجموعة الأسئلة بنجاح.',
        details: {
          databaseDeleted: true,
          bunnyDeletions: deletionResults,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ في الخادم.',
        details: {
          databaseDeleted: false,
          bunnyDeletions: [],
        },
      });
    }
  },
];
