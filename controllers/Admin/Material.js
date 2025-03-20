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
  body('icon.url')
    .optional()
    .isURL()
    .withMessage('يجب أن يكون رابط الأيقونة صالحاً.'),
  body('icon.publicId')
    .optional()
    .isString()
    .withMessage('يجب أن يكون المعرف العام للأيقونة نصاً.'),
  body('college')
    .notEmpty()
    .withMessage('معرف الكلية مطلوب.')
    .isMongoId()
    .withMessage('معرف الكلية غير صالح.'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { college } = req.body;
      const loadedCollege = await College.findById(college);
      if (!loadedCollege)
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الكلية.' });
      console.log(loadedCollege, req.body.year);
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
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const material = await Material.findByIdAndDelete(req.params.id);
      if (!material) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على المادة.' });
      }
      res.status(200).json({ message: 'تم حذف المادة بنجاح.' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];
