const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const University = require('../../models/University'); // Adjust the path as necessary
const { body, param, validationResult } = require('express-validator');
const { default: axios } = require('axios');

// Create a new university
exports.createUniversity = [
  // Validate only complex fields
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const university = new University(req.body);
      await university.save();
      const { _id, name, icon = '' } = university;

      res.status(201).json({ university: { _id, name, icon } });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

// Get all universities
exports.getUniversities = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const universities = await University.paginate(
      {},
      { page: page || 1, limit: limit || 10, select: 'name icon' }
    );
    res.status(200).json(universities);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

exports.updateUniversity = [
  param('id')
    .isMongoId()
    .withMessage('يرجى إدخال معرف الجامعة بشكل صحيح.'),
  body('name')
    .optional()
    .isString()
    .withMessage('اسم الجامعة يجب أن يكون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الأيقونة يجب أن يكون نصاً.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, icon } = req.body;
      const updateData = { name, icon };
      
      const university = await University.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select('name icon');

      if (!university) {
        return res.status(404).json({ error: 'الجامعة غير موجودة.' });
      }

      res.status(200).json(university);
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ في الخادم.' });
    }
  },
];

// Get a university by ID
exports.getUniversityById = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف الجامعة بشكل صحيح.'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const university = await University.findById(req.params.id).select(
        'name icon'
      );
      if (!university) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الجامعة.' });
      }
      res.status(200).json(university);
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ في الخادم.' });
    }
  },
];

// Delete a university by ID
exports.deleteUniversity = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف الجامعة بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const university = await University.findById(req.params.id);
      if (!university) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الجامعة.' });
      }

      // Capture file info before deletion
      const bunnyDeletions = [];
      if (university.icon?.accessUrl) {
        bunnyDeletions.push({
          type: 'icon',
          accessUrl: university.icon.accessUrl,
        });
      }

      // Delete database entry
      await University.deleteOne({ _id: req.params.id });

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
        message: 'تم حذف الجامعة بنجاح.',
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
