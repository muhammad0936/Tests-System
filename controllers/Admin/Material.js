const { default: axios } = require('axios');
const College = require('../../models/College');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new material
exports.createMaterial = [
  body('name').notEmpty().withMessage('اسم المادة مطلوب.'),
  body('year')
    .notEmpty()
    .withMessage('السنة مطلوبة.')
    .isNumeric()
    .withMessage('يجب أن تكون السنة رقماً.'),
  body('color').optional().isString().withMessage('يجب أن يكون اللون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),

  body('college')
    .notEmpty()
    .withMessage('معرف الكلية مطلوب.')
    .isMongoId()
    .withMessage('معرف الكلية غير صالح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { college } = req.body;
      const loadedCollege = await College.findById(college);
      if (!loadedCollege)
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الكلية.' });
      if (loadedCollege.numOfYears < req.body.year || req.body.year <= 0)
        return res.status(400).json({
          message: `الكلية تحتوي على ${loadedCollege.numOfYears} سنوات، والسنة المقدمة هي ${req.body.year}.`,
        });
      const material = new Material(req.body);
      await material.save();
      const { _id, name, year, color, icon } = material;
      res.status(201).json({
        material: { _id, name, year, color, icon },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

// Get materials with filters
exports.getMaterials = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { page, limit, college, year, name } = req.query;
    const filter = {};
    if (!college) {
      return res.status(400).json({ message: 'معرف الكلية مطلوب.' });
    }
    const collegeExists = await College.exists({ _id: college });
    if (!collegeExists) {
      return res
        .status(400)
        .json({ message: 'عذراً، لم يتم العثور على الكلية.' });
    }
    filter.college = college;
    if (year) {
      filter.year = Number(year);
    }
    if (name) {
      // optional: text search for material names (case-insensitive)
      filter.name = { $regex: name, $options: 'i' };
    }
    const materials = await Material.paginate(filter, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      populate: {
        path: 'college',
        select: 'name',
      },
      select: '-__v -createdAt -updatedAt',
    });
    res.status(200).json(materials);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

// Delete a material by ID
exports.deleteMaterial = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف المادة بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const material = await Material.findById(req.params.id);
      if (!material) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على المادة.' });
      }

      const bunnyDeletions = [];
      if (material.icon?.accessUrl) {
        bunnyDeletions.push({
          type: 'icon',
          accessUrl: material.icon.accessUrl,
        });
      }

      await Material.deleteOne({ _id: req.params.id });

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
        message: 'تم حذف المادة بنجاح.',
        details: {
          databaseDeleted: true,
          bunnyDeletions: deletionResults,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: 'حدث خطأ في الخادم.',
        details: {
          databaseDeleted: false,
          bunnyDeletions: [],
        },
      });
    }
  },
];
