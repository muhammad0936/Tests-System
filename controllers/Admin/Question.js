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
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
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
    const { limit, material } = req.query;

    if (!material) {
      return res.status(400).json({ message: 'Material is required!' });
    }

    // Check if the provided material exists
    const materialExists = await Material.exists({ _id: material });
    if (!materialExists) {
      return res.status(400).json({ message: 'Material not found!' });
    }

    const sampleSize = parseInt(limit, 10) || 10;
    const filter = { material: new mongoose.Types.ObjectId(material) };

    // Use aggregation pipeline with $match and $sample for random selection
    const questions = await Question.aggregate([
      { $match: filter },
      { $sample: { size: sampleSize } },
    ]);

    // Optionally populate the material details (like name) in the returned questions.
    // Since aggregation returns plain objects, we can use Mongoose's populate afterwards.
    const populatedQuestions = await Question.populate(questions, {
      path: 'material',
      select: 'name',
    });

    res.status(200).json({
      docs: populatedQuestions,
      limit: sampleSize,
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
