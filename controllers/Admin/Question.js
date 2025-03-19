const Question = require('../../models/Question');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { shuffleArray } = require('../../util/shuffleArray');
const Material = require('../../models/Material');
const { default: mongoose } = require('mongoose');

// Create a new question
exports.createQuestion = [
  body('text').notEmpty().withMessage('Question text is required'),
  body('isMultipleChoice')
    .optional()
    .isBoolean()
    .withMessage('isMultipleChoice must be a boolean'),
  // If choices are provided for multiple choice questions, validate them.
  body('choices')
    .if((value, { req }) => req.body.isMultipleChoice)
    .isArray({ min: 1 })
    .withMessage(
      'At least one choice is required for multiple choice questions'
    ),
  body('choices.*.text')
    .if(body('choices').exists())
    .notEmpty()
    .withMessage('Choice text is required'),
  body('choices.*.isCorrect')
    .if(body('choices').exists())
    .optional()
    .isBoolean()
    .withMessage('Choice isCorrect must be a boolean'),
  body('information')
    .optional()
    .isString()
    .withMessage('Information is required'),
  body('image.url').optional().isURL().withMessage('Image URL must be valid'),
  body('image.publicId')
    .optional()
    .isString()
    .withMessage('Image publicId must be a string'),
  body('material')
    .notEmpty()
    .withMessage('Material ID is required')
    .isMongoId()
    .withMessage('Invalid Material ID'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const materialExists = await Material.exists({ _id: req.body.material });
      if (!materialExists)
        return res.status(400).json({ message: 'Material not found!' });
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
        .json({ error: err.message || 'Server error' });
    }
  },
];
exports.getQuestions = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { limit = 10, page = 1, material } = req.query;

    if (!material) {
      return res.status(400).json({ message: 'Material is required!' });
    }

    // Check if the provided material exists
    const materialExists = await Material.exists({ _id: material });
    if (!materialExists) {
      return res.status(400).json({ message: 'Material not found!' });
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
      .json({ error: err.message || 'Server error' });
  }
};

// Delete a question by ID
exports.deleteQuestion = [
  param('id').isMongoId().withMessage('Invalid Question ID'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const question = await Question.findByIdAndDelete(req.params.id);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }
      res.status(200).json({ message: 'Question deleted successfully' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];
