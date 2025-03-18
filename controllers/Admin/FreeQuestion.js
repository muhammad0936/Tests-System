const FreeQuestion = require('../../models/FreeQuestion');
const Question = require('../../models/Question');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

exports.copyQuestionsToFree = [
  body('numOfQuestions')
    .isInt({ min: 1 })
    .withMessage('numOfQuestions must be a positive integer'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { numOfQuestions } = req.body;
      let totalCopied = 0;

      // Clear existing free questions first
      await FreeQuestion.deleteMany({});

      // Get all materials that have questions
      const materials = await Material.find({
        _id: { $in: await Question.distinct('material') },
      });

      // Process each material
      for (const material of materials) {
        // Get random questions for current material
        const questions = await Question.aggregate([
          { $match: { material: material._id } },
          { $sample: { size: numOfQuestions } },
          { $project: { __v: 0, createdAt: 0, updatedAt: 0 } },
        ]);

        if (questions.length === 0) continue;

        // Add college reference through material
        // CORRECTED VERSION (removes college reference)
        // const freeQuestions = questions.map(question => ({
        //   text: question.text,
        //   isMultipleChoice: question.isMultipleChoice,
        //   choices: question.choices,
        //   information: question.information,
        //   image: question.image,
        //   material: question.material // Only keep material reference
        // }));

        // Insert into FreeQuestion collection
        const result = await FreeQuestion.insertMany(questions);
        totalCopied += result.length;
      }

      res.status(200).json({
        message: `Successfully replaced all free questions with ${totalCopied} new questions`,
        totalCopied,
        materialsProcessed: materials.length,
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];
