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
  body('prevYearTitle')
    .optional()
    .isString()
    .withMessage('يجب أن تكون معلومات الدورة نصية نصية.'),
  body('materialSection')
    .optional()
    .isString()
    .withMessage('يجب أن يكون القسم نصاً.'),

  // Updated image validation for array
  body('images').optional().isArray().withMessage('يجب أن تكون الصور مصفوفة.'),
  body('images.*.filename')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('images.*.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),

  body('material').notEmpty().isMongoId().withMessage('معرف المادة غير صالح.'),

  body('questions')
    .isArray({ min: 1 })
    .withMessage('يجب إدخال مجموعة من الأسئلة.'),

  body('questions.*.infoImages')
    .optional()
    .isArray()
    .withMessage('يجب أن تكون صور المعلومات مصفوفة.'),
  body('questions.*.infoImages.*.filename')
    .notEmpty()
    .withMessage('اسم ملف صورة المعلومات مطلوب.')
    .isString(),
  body('questions.*.infoImages.*.accessUrl')
    .notEmpty()
    .withMessage('رابط الوصول لصورة المعلومات مطلوب.')
    .isString(),

  body('questions').custom((questions) => {
    questions.forEach((question, index) => {
      if (!question.text?.trim()) {
        throw new Error(`نص السؤال مطلوب للسؤال رقم ${index + 1}.`);
      }

      if (!question.choices?.length || question.choices.length < 2) {
        throw new Error(
          `يجب أن يحتوي السؤال رقم ${index + 1} على خيارين على الأقل.`
        );
      }

      question.choices.forEach((choice, choiceIndex) => {
        if (!choice.text?.trim()) {
          throw new Error(
            `نص الاختيار مطلوب في السؤال رقم ${index + 1}, الاختيار رقم ${
              choiceIndex + 1
            }.`
          );
        }
      });

      const correctChoices = question.choices.filter((c) => c.isCorrect).length;
      if (correctChoices < 1) {
        throw new Error(
          `يجب تحديد إجابة صحيحة واحدة على الأقل في السؤال رقم ${index + 1}.`
        );
      }

      // Validate infoImages structure
      if (question.infoImages) {
        question.infoImages.forEach((img, imgIndex) => {
          if (!img.filename?.trim()) {
            throw new Error(
              `اسم الملف مطلوب لصورة المعلومات ${imgIndex + 1} في السؤال ${
                index + 1
              }.`
            );
          }
          if (!img.accessUrl?.trim()) {
            throw new Error(
              `رابط الوصول مطلوب لصورة المعلومات ${imgIndex + 1} في السؤال ${
                index + 1
              }.`
            );
          }
        });
      }
    });
    return true;
  }),

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
exports.updateQuestionGroup = [
  param('id')
    .isMongoId()
    .withMessage('معرف مجموعة الأسئلة غير صالح.'),
  body('paragraph')
    .optional()
    .isString()
    .withMessage('يجب أن تكون الفقرة نصية.'),
  body('prevYearTitle')
    .optional()
    .isString()
    .withMessage('يجب أن تكون معلومات الدورة نصية.'),
  body('materialSection')
    .optional()
    .isString()
    .withMessage('يجب أن يكون القسم نصاً.'),
  body('images')
    .optional()
    .isArray()
    .withMessage('يجب أن تكون الصور مصفوفة.'),
  body('images.*.filename')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('images.*.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),
  body('material')
    .optional()
    .isMongoId()
    .withMessage('معرف المادة غير صالح.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const groupId = req.params.id;
      const updateData = req.body;
      const group = await QuestionGroup.findById(groupId);

      if (!group) {
        return res.status(404).json({ message: 'مجموعة الأسئلة غير موجودة.' });
      }

      // تحديث المادة مع التحقق من وجودها
      if (updateData.material) {
        const materialExists = await Material.exists({ _id: updateData.material });
        if (!materialExists) {
          return res.status(400).json({ message: 'المادة المحددة غير موجودة.' });
        }
        group.material = updateData.material;
      }

      // معالجة الصور المرفقة
      if (updateData.images !== undefined) {
        const oldImages = group.images || [];
        const newImages = updateData.images;

        // تحديد الصور المحذوفة
        const imagesToDelete = oldImages.filter(oldImage => 
          !newImages.some(newImage => newImage.accessUrl === oldImage.accessUrl)
        );

        // حذف الصور من التخزين
        for (const image of imagesToDelete) {
          try {
            await axios.delete(image.accessUrl, {
              headers: {
                Accept: 'application/json',
                AccessKey: process.env.BUNNY_STORAGE_API_KEY,
              },
            });
          } catch (error) {
            console.error('فشل في حذف الصورة:', image.accessUrl, error.message);
          }
        }

        group.images = newImages;
      }

      // تحديث الحقول الأخرى
      if (updateData.paragraph !== undefined) group.paragraph = updateData.paragraph;
      if (updateData.prevYearTitle !== undefined) group.prevYearTitle = updateData.prevYearTitle;
      if (updateData.materialSection !== undefined) group.materialSection = updateData.materialSection;

      await group.save();

      res.json({
        message: 'تم تحديث مجموعة الأسئلة بنجاح.',
        group,
      });
    } catch (err) {
      res.status(500).json({ 
        error: err.message || 'حدث خطأ في الخادم.' 
      });
    }
  },
];
// getQuestionGroups remains unchanged
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

      // Capture all files for deletion
      const bunnyDeletions = [];

      // Group images (updated for array)
      if (group.images?.length > 0) {
        group.images.forEach((image) => {
          if (image.accessUrl) {
            bunnyDeletions.push({
              type: 'question_image',
              accessUrl: image.accessUrl,
            });
          }
        });
      }

      // Info images from questions
      group.questions.forEach((question) => {
        if (question.infoImages) {
          question.infoImages.forEach((img) => {
            if (img.accessUrl) {
              bunnyDeletions.push({
                type: 'question_info_image',
                accessUrl: img.accessUrl,
              });
            }
          });
        }
      });

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

exports.deleteQuestion = [
  // Validate IDs and index
  param('questionGroupId')
    .isMongoId()
    .withMessage('معرف مجموعة الأسئلة غير صالح.'),
  param('questionIndex')
    .isInt({ min: 0 })
    .withMessage('رقم السؤال يجب أن يكون عدداً صحيحاً غير سالب.'),

  // Controller logic
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { questionGroupId, questionIndex } = req.params;
      const group = await QuestionGroup.findById(questionGroupId);

      if (!group) {
        return res.status(404).json({ message: 'مجموعة الأسئلة غير موجودة.' });
      }

      // Check if index is valid
      if (questionIndex >= group.questions.length) {
        return res.status(400).json({
          message: `السؤال رقم ${questionIndex + 1} غير موجود في المجموعة.`,
        });
      }

      // Remove the question
      group.questions.splice(questionIndex, 1);
      await group.save();

      res.json({ message: 'تم حذف السؤال بنجاح.' });
    } catch (err) {
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

exports.updateQuestion = [
  // Validate IDs and index
  param('questionGroupId')
    .isMongoId()
    .withMessage('معرف مجموعة الأسئلة غير صالح.'),
  param('questionIndex')
    .isInt({ min: 0 })
    .withMessage('رقم السؤال يجب أن يكون عدداً صحيحاً غير سالب.'),

  // Validate incoming question data (similar to create)
  body('text').optional().notEmpty().withMessage('نص السؤال مطلوب.'),
  body('isMultipleChoice')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isMultipleChoice قيمة منطقية.'),
  body('isEnglish')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isEnglish قيمة منطقية.'),
  body('information')
    .optional()
    .isString()
    .withMessage('يجب أن تكون المعلومات نصاً.'),
  body('choices')
    .optional()
    .isArray({ min: 2 })
    .withMessage('الخيارات يجب أن تكون قائمة تحتوي على خيارين على الأقل.'),
  body('choices.*.text')
    .optional()
    .notEmpty()
    .withMessage('نص الاختيار مطلوب.'),
  body('choices.*.isCorrect')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isCorrect قيمة منطقية.'),

  // Custom validation for choices and infoImages
  body().custom((bodyData) => {
    const question = bodyData;

    // Validate text (if provided)
    if (question.text && !question.text.trim()) {
      throw new Error('نص السؤال مطلوب.');
    }

    // Validate choices (if provided)
    if (question.choices) {
      if (question.choices.length < 2) {
        throw new Error('يجب أن يحتوي السؤال على خيارين على الأقل.');
      }

      let correctChoices = 0;
      question.choices.forEach((choice, index) => {
        if (!choice.text?.trim()) {
          throw new Error(`نص الاختيار مطلوب للاختيار رقم ${index + 1}.`);
        }
        if (choice.isCorrect) correctChoices++;
      });

      if (correctChoices < 1) {
        throw new Error('يجب تحديد إجابة صحيحة واحدة على الأقل.');
      }
    }

    // Validate infoImages (if provided)
    if (question.infoImages) {
      question.infoImages.forEach((img, index) => {
        if (!img.filename?.trim() || !img.accessUrl?.trim()) {
          throw new Error(
            `يجب تقديم اسم الملف ورابط الوصول لصورة المعلومات رقم ${index + 1}.`
          );
        }
      });
    }

    return true;
  }),

  // Controller logic
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { questionGroupId, questionIndex } = req.params;
      const updates = req.body;

      const group = await QuestionGroup.findById(questionGroupId);
      if (!group) {
        return res.status(404).json({ message: 'مجموعة الأسئلة غير موجودة.' });
      }

      // Check if index is valid
      if (questionIndex >= group.questions.length) {
        return res.status(400).json({
          message: `السؤال رقم ${questionIndex + 1} غير موجود في المجموعة.`,
        });
      }

      // Update the question
      const questionToUpdate = group.questions[questionIndex];
      Object.keys(updates).forEach((key) => {
        questionToUpdate[key] = updates[key];
      });

      await group.save();
      res.json({
        message: 'تم تحديث السؤال بنجاح.',
        question: questionToUpdate,
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];
