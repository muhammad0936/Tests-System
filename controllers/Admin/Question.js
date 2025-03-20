const Question = require('../../models/Question');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { shuffleArray } = require('../../util/shuffleArray');
const Material = require('../../models/Material');
const { default: mongoose } = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // if you need uuid in Questions as well
// Assume Material and Question are your Mongoose models
// Assume ensureIsAdmin is a middleware function that verifies admin privileges

exports.createQuestions = [
  // Validate that questions is a non-empty array.
  body('questions')
    .isArray({ min: 1 })
    .withMessage('يجب إدخال مجموعة من الأسئلة.'),

  // Custom validator to check each question’s internal logic.
  body('questions').custom((questions) => {
    questions.forEach((question, index) => {
      // Validate that question text exists.
      if (!question.text || question.text.trim() === '') {
        throw new Error(`نص السؤال مطلوب للسؤال رقم ${index + 1}.`);
      }
      // If the question is multiple choice, ensure choices is a non-empty array.
      if (question.isMultipleChoice) {
        if (!Array.isArray(question.choices) || question.choices.length < 1) {
          throw new Error(
            `يجب إدخال خيار واحد على الأقل للأسئلة متعددة الاختيارات في السؤال رقم ${
              index + 1
            }.`
          );
        }
        // Validate each choice.
        question.choices.forEach((choice, choiceIndex) => {
          if (!choice.text || choice.text.trim() === '') {
            throw new Error(
              `نص الاختيار مطلوب في السؤال رقم ${index + 1}, الاختيار رقم ${
                choiceIndex + 1
              }.`
            );
          }
          if (
            choice.isCorrect !== undefined &&
            typeof choice.isCorrect !== 'boolean'
          ) {
            throw new Error(
              `يجب أن يكون isCorrect قيمة منطقية في السؤال رقم ${
                index + 1
              }, الاختيار رقم ${choiceIndex + 1}.`
            );
          }
        });
      }
      if (question.information && typeof question.information !== 'string') {
        throw new Error(
          `يجب أن تكون المعلومات نصاً في السؤال رقم ${index + 1}.`
        );
      }
      if (question.image) {
        if (question.image.url && typeof question.image.url !== 'string') {
          throw new Error(
            `يجب أن يكون رابط الصورة صالحاً في السؤال رقم ${index + 1}.`
          );
        }
        if (
          question.image.publicId &&
          typeof question.image.publicId !== 'string'
        ) {
          throw new Error(
            `يجب أن يكون معرف الصورة نصاً في السؤال رقم ${index + 1}.`
          );
        }
      }
      if (!question.material) {
        throw new Error(`معرف المادة مطلوب في السؤال رقم ${index + 1}.`);
      }
      // Optionally, if you have a helper to validate ObjectId format, you could do that here.
    });
    return true;
  }),

  // Express-validator chain for each nested field
  body('questions.*.text').notEmpty().withMessage('نص السؤال مطلوب.'),
  body('questions.*.isMultipleChoice')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isMultipleChoice قيمة منطقية.'),
  body('questions.*.choices')
    .optional()
    .isArray()
    .withMessage('الخيارات يجب أن تكون في شكل قائمة.'),
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
  body('questions.*.image.url')
    .optional()
    .isURL()
    .withMessage('يجب أن يكون رابط الصورة صالحاً.'),
  body('questions.*.image.publicId')
    .optional()
    .isString()
    .withMessage('يجب أن يكون معرف الصورة نصاً.'),
  body('questions.*.material')
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

      const questionsPayload = req.body.questions;
      const createdQuestions = [];

      // Process each question one by one.
      for (let questionData of questionsPayload) {
        // Verify the material for the question.
        const materialExists = await Material.exists({
          _id: questionData.material,
        });
        if (!materialExists) {
          return res.status(400).json({
            message: `عذراً، لم يتم العثور على المادة في السؤال: ${questionData.text}`,
          });
        }

        const newQuestion = new Question(questionData);
        await newQuestion.save();
        createdQuestions.push(newQuestion);
      }

      res.status(201).json({
        message: 'تم إنشاء مجموعة الأسئلة بنجاح.',
        questions: createdQuestions,
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
