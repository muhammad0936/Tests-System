const { body, param, query, validationResult } = require('express-validator');
const {
  Types: { ObjectId },
  mongoose,
} = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Material = require('../../models/Material');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { v4: uuidv4 } = require('uuid');
const Student = require('../../models/Student');

// Create Codes Group
exports.createCodesGroup = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be less than 100 characters'),
  body('materials')
    .optional()
    .isArray()
    .withMessage('Materials must be an array')
    .custom((value) => value.every((id) => ObjectId.isValid(id)))
    .withMessage('Invalid Material ID format'),
  body('courses')
    .optional()
    .isArray()
    .withMessage('Courses must be an array')
    .custom((value) => value.every((id) => ObjectId.isValid(id)))
    .withMessage('Invalid Course ID format'),
  body('codeCount')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Code count must be between 1 and 10000'),
  body('expiration')
    .isISO8601()
    .withMessage('Invalid expiration date format')
    .custom((value) => new Date(value) > new Date())
    .withMessage('Expiration must be in the future'),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        name,
        materials = [],
        courses = [],
        codeCount,
        expiration,
      } = req.body;

      // Verify materials exist
      if (materials.length > 0) {
        const existingMaterials = await Material.countDocuments({
          _id: { $in: materials },
        });
        if (existingMaterials !== materials.length) {
          return res
            .status(404)
            .json({ error: 'One or more materials not found' });
        }
      }

      // Verify courses exist
      if (courses.length > 0) {
        const existingCourses = await Course.countDocuments({
          _id: { $in: courses },
        });
        if (existingCourses !== courses.length) {
          return res
            .status(404)
            .json({ error: 'One or more courses not found' });
        }
      }

      // Generate unique codes
      const codes = Array.from({ length: codeCount }, () => ({
        value: uuidv4().replace(/-/g, '').substring(0, 12),
        isUsed: false,
      }));

      const codesGroup = new CodesGroup({
        name,
        codes,
        materials,
        courses,
        expiration: new Date(expiration),
      });

      await codesGroup.save();

      res.status(201).json({
        message: 'Codes group created successfully',
        data: {
          _id: codesGroup._id,
          name: codesGroup.name,
          codeCount: codesGroup.codes.length,
          expiration: codesGroup.expiration,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'Server error creating codes group',
      });
    }
  },
];

// Get Codes Groups
exports.getCodesGroups = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('name').optional().trim(),
  query('material').optional().isMongoId(),
  query('course').optional().isMongoId(),
  query('expirationFrom').optional().isISO8601(),
  query('expirationTo').optional().isISO8601(),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        page = 1,
        limit = 10,
        name,
        material,
        course,
        expirationFrom,
        expirationTo,
      } = req.query;

      const filter = {};
      if (name) filter.name = { $regex: name, $options: 'i' };
      if (material) filter.materials = new ObjectId(material);
      if (course) filter.courses = new ObjectId(course);

      if (expirationFrom || expirationTo) {
        filter.expiration = {};
        if (expirationFrom) filter.expiration.$gte = new Date(expirationFrom);
        if (expirationTo) filter.expiration.$lte = new Date(expirationTo);
      }

      const result = await CodesGroup.paginate(filter, {
        page,
        limit,
        sort: { createdAt: -1 },
        populate: [
          {
            path: 'materials',
            select: 'name',
            populate: {
              path: 'college',
              select: 'name',
              populate: { path: 'university', select: 'name' },
            },
          },
          {
            path: 'courses',
            select: 'name',
            populate: {
              path: 'material',
              select: 'name',
              populate: {
                path: 'college',
                select: 'name',
                populate: { path: 'university', select: 'name' },
              },
            },
          },
        ],
        select: 'name codes expiration materials courses',
      });

      // Add usage statistics
      const enhancedDocs = result.docs.map((group) => ({
        _id: group._id,
        name: group.name,
        expiration: group.expiration,
        totalCodes: group.codes.length,
        usedCodes: group.codes.filter((c) => c.isUsed).length,
        materials: group.materials,
        courses: group.courses,
      }));
      res.status(200).json({
        message: 'Codes groups retrieved successfully',
        data: enhancedDocs,
        total: result.totalDocs,
        page: result.page,
        pages: result.totalPages,
        limit: result.limit,
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error fetching codes groups' });
    }
  },
];
exports.getCodesFromGroup = [
  param('id').isMongoId().withMessage('Invalid CodesGroup ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('usage')
    .optional()
    .isIn(['all', 'used', 'unused'])
    .withMessage('Invalid usage filter'),

  async (req, res) => {
    // await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { usage = 'all', page = 1, limit = 10 } = req.query;

      const codesGroup = await CodesGroup.findById(id).select(
        'name expiration codes'
      );
      if (!codesGroup) {
        return res.status(404).json({ error: 'CodesGroup not found' });
      }

      // Apply usage filter
      let filteredCodes = codesGroup.codes;
      switch (usage) {
        case 'used':
          filteredCodes = codesGroup.codes.filter((c) => c.isUsed);
          break;
        case 'unused':
          filteredCodes = codesGroup.codes.filter((c) => !c.isUsed);
          break;
      }

      // Pagination calculations
      const totalCodes = filteredCodes.length;
      const totalPages = Math.ceil(totalCodes / limit);
      const startIndex = (page - 1) * limit;
      const paginatedCodes = filteredCodes.slice(
        startIndex,
        startIndex + limit
      );

      // Response data
      const response = {
        _id: codesGroup._id,
        name: codesGroup.name,
        expiration: codesGroup.expiration,
        totalCodes: totalCodes,
        totalUsed: codesGroup.codes.filter((c) => c.isUsed).length,
        codes: paginatedCodes,
        filter: usage,
      };

      return res.status(200).json({
        message: 'Codes retrieved successfully',
        data: response,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          totalCodes,
          totalPages,
        },
      });
    } catch (err) {
      return res.status(500).json({
        error: err.message || 'Server error fetching codes',
      });
    }
  },
];

// Delete Codes Group
exports.deleteCodesGroup = [
  param('id').isMongoId().withMessage('Invalid Codes Group ID'),

  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const group = await CodesGroup.findById(req.params.id);

      if (!group) {
        return res.status(404).json({ error: 'Codes group not found' });
      }

      // Check if any codes are used
      const hasUsedCodes = group.codes.some((c) => c.isUsed);
      if (hasUsedCodes) {
        return res.status(400).json({
          error: 'Cannot delete group with used codes',
        });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Delete the codes group
        await CodesGroup.deleteOne({ _id: req.params.id }, { session });

        // Remove references from students
        await Student.updateMany(
          { 'redeemedCodes.codesGroup': req.params.id },
          { $pull: { redeemedCodes: { codesGroup: req.params.id } } },
          { session }
        );

        await session.commitTransaction();
        res.status(200).json({ message: 'Codes group deleted successfully' });
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: 'Server error deleting codes group' });
    }
  },
];
// generate pdf
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
exports.exportCodeCardsPDF = [
  param('id').isMongoId().withMessage('Invalid CodesGroup ID'),

  async (req, res) => {
    // await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const codesGroup = await mongoose
        .model('CodesGroup')
        .findById(req.params.id)
        .populate([
          { path: 'materials', select: 'name' },
          { path: 'courses', select: 'name' },
        ])
        .lean();

      if (!codesGroup) {
        return res.status(404).json({ error: 'CodesGroup not found' });
      }

      const unusedCodes = codesGroup.codes.filter((c) => !c.isUsed);
      if (unusedCodes.length === 0) {
        return res.status(400).json({ error: 'No unused codes available' });
      }

      const doc = new PDFDocument({
        layout: 'portrait',
        size: 'A4',
        margin: 0,
        info: {
          Title: `${codesGroup.name} Access Cards`,
          Author: 'Education Platform',
          CreationDate: new Date(),
        },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${codesGroup.name}_Access_Cards.pdf"`
      );

      doc.pipe(res);

      const centeredText = (text, y, size = 12) => {
        doc.fontSize(size).text(text, 0, y, { align: 'center', width: 612 });
      };

      const createCodeCard = async (code) => {
        // Calculate content height
        const lineHeights = {
          header: 19.2, // 16pt * 1.2 line height
          subheader: 14.4, // 12pt * 1.2
          qr: 200,
          section: 16.8, // 14pt * 1.2
        };

        let totalHeight =
          lineHeights.header + lineHeights.subheader * 2 + 40 + lineHeights.qr;
        const hasMaterials = codesGroup.materials.length > 0;
        const hasCourses = codesGroup.courses.length > 0;

        if (hasMaterials) totalHeight += lineHeights.section + 20;
        if (hasCourses) totalHeight += lineHeights.section + 20;

        const startY = (842 - totalHeight) / 2;
        let currentY = startY;

        // Header Section
        centeredText(codesGroup.name, currentY, 16);
        currentY += lineHeights.header;

        centeredText(
          `Expires: ${new Date(codesGroup.expiration).toLocaleDateString()}`,
          currentY
        );
        currentY += lineHeights.subheader;

        centeredText(`Code: ${code.value}`, currentY);
        currentY += lineHeights.subheader + 20;

        // Centered QR Code
        const qrBuffer = await QRCode.toBuffer(code.value, {
          errorCorrectionLevel: 'H',
          width: 200,
          margin: 1,
        });
        const qrX = (612 - 200) / 2;
        doc.image(qrBuffer, qrX, currentY, { width: 200 });
        currentY += lineHeights.qr + 20;

        // Materials
        if (hasMaterials) {
          const materialsText = `Materials: ${codesGroup.materials
            .map((m) => m.name)
            .join(' - ')}`;
          centeredText(materialsText, currentY, 14);
          currentY += lineHeights.section + 20;
        }

        // Courses
        if (hasCourses) {
          const coursesText = `Courses: ${codesGroup.courses
            .map((c) => c.name)
            .join(' - ')}`;
          centeredText(coursesText, currentY, 14);
        }
      };

      // Generate pages
      for (const code of unusedCodes) {
        await createCodeCard(code);
        if (code !== unusedCodes[unusedCodes.length - 1]) {
          doc.addPage();
        }
      }

      doc.end();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      res.status(500).json({
        error: err.message || 'Failed to generate access cards',
      });
    }
  },
];
