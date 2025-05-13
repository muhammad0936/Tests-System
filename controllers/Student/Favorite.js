const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Student = require('../../models/Student');
const QuestionGroup = require('../../models/QuestionGroup');

exports.addFavoriteQuestionGroup = [
  body('questionGroupId')
    .notEmpty()
    .withMessage('معرف مجموعة الأسئلة مطلوب.')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('صيغة معرف مجموعة الأسئلة غير صالحة.'),
  body('index')
    .notEmpty()
    .withMessage('موقع السؤال مطلوب')
    .custom((value) => {
      if (typeof value !== 'number') {
        throw new Error('موقع السؤال يجب أن يكون رقما حقيقيا');
      }
      return true;
    }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.userId;
      let { questionGroupId, index = 0 } = req.body;
      index = +index;

      const questionGroup = await QuestionGroup.findById(questionGroupId);
      if (!questionGroup) {
        return res.status(404).json({
          message: 'عذراً، لم يتم العثور على مجموعة الأسئلة.',
        });
      }

      const student = await Student.findById(studentId).populate({
        path: 'redeemedCodes.codesGroup',
        select: 'materialsWithQuestions',
      });

      if (!student) {
        return res
          .status(404)
          .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
      }

      // Get all materials with question access
      const accessibleMaterials = student.redeemedCodes
        .filter((rc) => rc.codesGroup) // Add null check
        .map((rc) =>
          rc.codesGroup.materialsWithQuestions.map((id) => id.toString())
        )
        .flat();

      if (!accessibleMaterials.includes(questionGroup.material.toString())) {
        return res
          .status(400)
          .json({ message: 'ليس لك صلاحية الوصول إلى هذا السؤال' });
      }

      if (
        student.favorites.some(
          (fav) =>
            fav.questionGroup.toString() === questionGroupId &&
            fav.index === index
        )
      ) {
        return res
          .status(400)
          .json({ message: 'مجموعة الأسئلة مضافة للمفضلة من قبل.' });
      }

      if (questionGroup?.questions?.length <= index) {
        return res.status(400).json({
          message: `موقع السؤال غير صالح, يجب أن يكون بين 0 و ${
            questionGroup.questions.length - 1
          }`,
        });
      }

      student.favorites.push({ questionGroup: questionGroupId, index });
      await student.save();

      res.status(200).json({
        message: 'تمت إضافة مجموعة الأسئلة إلى المفضلة بنجاح.',
      });
    } catch (err) {
      console.error('Error in addFavoriteQuestionGroup:', err);
      res.status(500).json({ error: 'حدث خطأ في الخادم.' });
    }
  },
];

exports.removeFavoriteQuestionGroup = [
  body('questionGroupId')
    .notEmpty()
    .withMessage('معرف مجموعة الأسئلة مطلوب.')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('صيغة معرف مجموعة الأسئلة غير صالحة.'),
  body('index')
    .notEmpty()
    .withMessage('موقع السؤال مطلوب')
    .isNumeric()
    .withMessage('موقع السؤال يجب أن يكون رقما'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.userId;
      const { questionGroupId, index } = req.body;

      const student = await Student.findById(studentId);
      if (!student) {
        return res
          .status(404)
          .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
      }

      const favoriteIndex = student.favorites.findIndex(
        (fav) =>
          fav.questionGroup.toString() === questionGroupId &&
          parseInt(index) === fav.index
      );

      if (favoriteIndex !== -1) {
        student.favorites.splice(favoriteIndex, 1);
        await student.save();
      }

      res.status(200).json({
        message:
          favoriteIndex !== -1
            ? 'تم حذف السؤال من المفضلة بنجاح.'
            : 'السؤال ليس موجودا في المفضلة مسبقا',
      });
    } catch (err) {
      console.error('Error in removeFavoriteQuestionGroup:', err);
      res.status(500).json({ error: 'حدث خطأ في الخادم.' });
    }
  },
];

exports.getFavoriteQuestionGroups = async (req, res) => {
  try {
    const studentId = req.userId;

    const student = await Student.findById(studentId).populate({
      path: 'favorites.questionGroup',
      select: '-__v -createdAt -updatedAt',
      populate: {
        path: 'material',
        select: 'name',
      },
    });

    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const returnedFavorites = student.favorites.map((f) => ({
      ...f.questionGroup.toObject(),
      questions: [f.questionGroup.questions[f.index]],
      index: f.index,
    }));

    res.status(200).json({ favorites: returnedFavorites });
  } catch (err) {
    console.error('Error in getFavoriteQuestionGroups:', err);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};
