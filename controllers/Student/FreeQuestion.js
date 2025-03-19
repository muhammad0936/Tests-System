const FreeQuestion = require('../../models/FreeQuestion');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { shuffleArray } = require('../../util/shuffleArray');
const Material = require('../../models/Material');
const { default: mongoose } = require('mongoose');
const Student = require('../../models/Student');
const College = require('../../models/College');
exports.getFreeQuestions = async (req, res) => {
  try {
    const { limit, material } = req.query;

    // Get student and validate college/year
    const student = await Student.findById(req.userId);
    if (!student.college) {
      return res.status(400).json({ message: 'الطالب ليس لديه معرف كلية!' });
    }

    const college = await College.findById(student.college);
    if (!college) {
      return res.status(400).json({ message: 'معرف الكلية غير صالح!' });
    }

    if (
      !student.year ||
      student.year > college.numOfYears ||
      student.year < 1
    ) {
      return res.status(400).json({
        message: `يجب أن تكون السنة الدراسية صالحة بين 1 و ${college.numOfYears}.`,
      });
    }

    // Validate material belongs to student's college/year
    const validMaterial = await Material.findOne({
      _id: material,
      college: student.college,
      year: student.year,
    });

    if (!validMaterial) {
      return res.status(400).json({
        message: 'المادة غير متوفرة في الموارد المجانية.',
      });
    }

    // Get random questions
    const sampleSize = parseInt(limit, 10) || 10;
    const questions = await FreeQuestion.aggregate([
      { $match: { material: new mongoose.Types.ObjectId(material) } },
      { $sample: { size: sampleSize } },
      { $project: { __v: 0 } },
    ]);

    // Populate material name
    const populatedQuestions = await FreeQuestion.populate(questions, {
      path: 'material',
      select: 'name',
    });

    res.status(200).json({
      docs: populatedQuestions,
      limit: sampleSize,
      total: populatedQuestions.length,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};
