const Question = require('../../models/Question');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { shuffleArray } = require('../../util/shuffleArray');
const Material = require('../../models/Material');
const { default: mongoose } = require('mongoose');

// Create a new question
exports.createQuestion = [
  body('text').notEmpty().withMessage('نص السؤال مطلوب.'),
  body('isMultipleChoice')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isMultipleChoice قيمة منطقية.'),
  // If choices are provided for multiple choice questions, validate them.
  body('choices')
    .if((value, { req }) => req.body.isMultipleChoice)
    .isArray({ min: 1 })
    .withMessage('يجب إدخال خيار واحد على الأقل للأسئلة متعددة الاختيارات.'),
  body('choices.*.text')
    .if(body('choices').exists())
    .notEmpty()
    .withMessage('نص الاختيار مطلوب.'),
  body('choices.*.isCorrect')
    .if(body('choices').exists())
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isCorrect قيمة منطقية.'),
  body('information')
    .optional()
    .isString()
    .withMessage('يجب أن تكون المعلومات نصاً.'),
  body('image.url')
    .optional()
    .isURL()
    .withMessage('يجب أن يكون رابط الصورة صالحاً.'),
  body('image.publicId')
    .optional()
    .isString()
    .withMessage('يجب أن يكون معرف الصورة نصاً.'),
  body('material')
    .notEmpty()
    .withMessage('معرف المادة مطلوب.')
    .isMongoId()
    .withMessage('معرف المادة غير صالح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const materialExists = await Material.exists({ _id: req.body.material });
      if (!materialExists)
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      const question = new Question(req.body);
      await question.save();
      const {
        _id,
        text,
        isMultipleChoice,
        choices,
        information,
        image,
        material,
      } = question;
      res.status(201).json({
        question: {
          _id,
          text,
          isMultipleChoice,
          choices,
          information,
          image,
          material,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

exports.getQuestions = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { limit = 10, page = 1, material } = req.query;

    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }

    // Check if the provided material exists
    const materialExists = await Material.exists({ _id: material });
    if (!materialExists) {
      return res
        .status(400)
        .json({ message: 'عذراً، لم يتم العثور على المادة.' });
    }

    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);
    const filter = { material: new mongoose.Types.ObjectId(material) };

    // Fetch total number of documents for pagination metadata
    const totalQuestions = await Question.countDocuments(filter);

    // Use pagination with skip and limit
    const questions = await Question.find(filter)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .populate('material', 'name'); // Populate material details if necessary

    res.status(200).json({
      docs: questions,
      totalDocs: totalQuestions,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalQuestions / pageSize),
    });
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

// Delete a question by ID
exports.deleteQuestion = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف السؤال بشكل صحيح.'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const question = await Question.findByIdAndDelete(req.params.id);
      if (!question) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على السؤال.' });
      }
      res.status(200).json({ message: 'تم حذف السؤال بنجاح.' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];
