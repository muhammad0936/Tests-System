const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const College = require('../../models/College'); // Adjust the path if necessary
const { body, param, validationResult } = require('express-validator');
const University = require('../../models/University');

// Create a new college
exports.createCollege = [
  body('name').notEmpty().withMessage('يرجى إدخال اسم الكلية.'),
  body('university')
    .notEmpty()
    .withMessage('رقم تعريف الجامعة مطلوب.')
    .isMongoId()
    .withMessage('رقم تعريف الجامعة غير صحيح.'),
  body('numOfYears')
    .notEmpty()
    .withMessage('عدد السنوات مطلوب.')
    .isNumeric()
    .withMessage('يجب إدخال عدد السنوات كرقم.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم الملف يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الوصول يجب أن يكون نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const universityExists = await University.exists({
        _id: req.body.university,
      });
      if (!universityExists) {
        return res
          .status(400)
          .json({ message: 'عذرًا، لم يتم العثور على الجامعة.' });
      }
      const college = new College(req.body);
      await college.save();
      const { _id, name, icon, university, numOfYears } = college;

      res
        .status(201)
        .json({ college: { _id, name, icon, university, numOfYears } });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// Get all colleges
exports.getColleges = async (req, res) => {
  try {
    const { page, limit, university } = req.query;

    const filter = {};
    if (!university) {
      return res.status(400).json({ message: 'يرجى تحديد الجامعة المطلوبة.' });
    }
    const universityExists = await University.exists({ _id: university });
    if (!universityExists) {
      return res
        .status(400)
        .json({ message: 'عذرًا، لم يتم العثور على الجامعة.' });
    }
    filter.university = university;
    const colleges = await College.paginate(filter, {
      page: page || 1,
      limit: limit || 10,
      select: 'name icon university numOfYears',
    });

    res.status(200).json(colleges);
  } catch (err) {
    res
      .status(500)
      .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
  }
};

// Get a college by ID
exports.getCollegeById = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الكلية بشكل صحيح.'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const college = await College.findById(req.params.id)
        .select('name icon university numOfYears')
        .populate({ path: 'university', select: 'name' }); // Populate university details
      if (!college) {
        return res
          .status(404)
          .json({ error: 'عذرًا، لم يتم العثور على الكلية.' });
      }
      res.status(200).json(college);
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// Update a college by ID
exports.updateCollege = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الكلية بشكل صحيح.'),
  body('name').optional().isString().withMessage('يرجى إدخال اسم الكلية كنص.'),
  body('university')
    .optional()
    .isMongoId()
    .withMessage('رقم تعريف الجامعة غير صحيح.'),
  body('numOfYears')
    .optional()
    .isNumeric()
    .withMessage('يجب إدخال عدد السنوات كرقم.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم الملف يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الوصول يجب أن يكون نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const baccCollege = await College.findOne({ name: 'بكالوريا' });
      console.log('college : ', baccCollege);
      if (baccCollege?._id.toString() === req.params.id) {
        delete req.body.name;
        delete req.body.numOfYears;
        delete req.body.university;
      }
      const college = await College.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!college) {
        return res
          .status(404)
          .json({ error: 'عذرًا، لم يتم العثور على الكلية.' });
      }
      const { _id, name, icon, university, numOfYears } = college;
      res
        .status(200)
        .json({ college: { _id, name, icon, university, numOfYears } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// Delete a college by ID
exports.deleteCollege = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الكلية بشكل صحيح.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const college = await College.findByIdAndDelete(req.params.id);
      if (!college) {
        return res
          .status(404)
          .json({ error: 'عذرًا، لم يتم العثور على الكلية.' });
      }
      res.status(200).json({ message: 'تم حذف الكلية بنجاح.' });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];
