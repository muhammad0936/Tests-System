const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Material = require('../../models/Material');
const Student = require('../../models/Student');
const College = require('../../models/College');
const University = require('../../models/University');
const Question = require('../../models/Question');

//[[[[[[[[[[[]]]]]]]]]]]
exports.getUniversitiesWithAccessibleMaterials = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Get student's accessible materials
    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const now = new Date();
    const materialIds = new Set();

    // Validate redeemed codes and collect materials
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        'codes.value': redemption.code,
        'codes.isUsed': true,
      }).select('materials');

      if (codesGroup) {
        codesGroup.materials.forEach((materialId) =>
          materialIds.add(materialId.toString())
        );
      }
    }

    // Early return if no materials
    const materialIdsArray = Array.from(materialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    if (!materialIdsArray.length) {
      return res.status(200).json({
        docs: [],
        totalDocs: 0,
        totalPages: 0,
        page: 1,
        limit: 10,
      });
    }

    // Get colleges associated with materials
    const materials = await Material.find({ _id: { $in: materialIdsArray } })
      .select('college')
      .lean();

    const collegeIds = [
      ...new Set(materials.map((m) => m.college.toString())),
    ].map((id) => new mongoose.Types.ObjectId(id));

    // Get universities containing these colleges
    const colleges = await College.find({ _id: { $in: collegeIds } })
      .select('university')
      .lean();

    const universityIds = [
      ...new Set(colleges.map((c) => c.university.toString())),
    ].map((id) => new mongoose.Types.ObjectId(id));

    // Paginate universities with filtered colleges
    const result = await University.paginate(
      { _id: { $in: universityIds } },
      {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        select: 'name icon',
        sort: { name: 1 },
      }
    );

    res.status(200).json({
      ...result,
      totalDocs: result?.docs?.length,
    });
  } catch (err) {
    console.log(err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Server error',
    });
  }
};

//[[[[[[[[[[[]]]]]]]]]]]

exports.getAccessibleCollegesByUniversity = async (req, res) => {
  try {
    const { page = 1, limit = 10, university } = req.query;

    // Validate university ID format
    if (!mongoose.Types.ObjectId.isValid(university)) {
      return res.status(400).json({ message: 'Invalid university ID format' });
    }

    // Check university exists
    const universityExists = await University.exists({ _id: university });
    if (!universityExists) {
      return res.status(404).json({ message: 'University not found' });
    }

    // Get student with redeemed codes
    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const now = new Date();
    const materialIds = new Set();

    // Validate code redemptions and collect materials
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        'codes.value': redemption.code,
        'codes.isUsed': true,
      }).select('materials');

      if (codesGroup) {
        codesGroup.materials.forEach((id) => materialIds.add(id.toString()));
      }
    }

    // Early return if no accessible materials
    const materialIdsArray = Array.from(materialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    if (!materialIdsArray.length) {
      return res.status(200).json({
        docs: [],
        totalDocs: 0,
        totalPages: 0,
        page: 1,
        limit: parseInt(limit, 10),
      });
    }

    // Get colleges associated with materials
    const collegeIds = await Material.distinct('college', {
      _id: { $in: materialIdsArray },
    });

    // Paginate colleges within specified university
    const colleges = await College.paginate(
      {
        university: university,
        _id: { $in: collegeIds },
      },
      {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        select: 'name icon numOfYears',
        sort: { name: 1 },
      }
    );

    res.status(200).json({
      ...colleges,
      totalDocs: colleges?.docs?.length,
    });
  } catch (err) {
    console.log(err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Server error',
    });
  }
};

//[[[[[[[[[[[]]]]]]]]]]]

exports.getAccessibleMaterials = async (req, res) => {
  try {
    const { page = 1, limit = 10, college } = req.query;

    // Fetch student with redeemed codes
    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    if (!college) {
      return res.status(400).json({ message: 'Please provide college ID!' });
    }
    const loadedCollege = await College.findById(college);
    if (!loadedCollege) {
      return res.status(400).json({ message: 'Invalid college ID!' });
    }
    const now = new Date();
    const materialIds = new Set();

    // Check each redemption for valid codes group and used code
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        'codes.value': redemption.code,
        'codes.isUsed': true,
      }).select('materials');

      if (codesGroup) {
        codesGroup.materials.forEach((materialId) => {
          materialIds.add(materialId.toString());
        });
      }
    }

    // Convert material IDs to ObjectIds
    const materialIdsArray = Array.from(materialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Paginate materials
    const materials = await Material.paginate(
      { _id: { $in: materialIdsArray }, college },
      {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: { path: 'college', select: 'name' },
        select: '-__v -createdAt -updatedAt',
      }
    );

    res.status(200).json(materials);
  } catch (err) {
    console.log(err);
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Server error' });
  }
};

exports.getAccessibleQuestions = async (req, res) => {
  try {
    const { limit = 10, page = 1, material } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!material) {
      return res
        .status(400)
        .json({ message: 'Material parameter is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'Invalid material ID format' });
    }

    // Convert to ObjectId once
    const materialId = new mongoose.Types.ObjectId(material);

    // Verify material exists
    const materialExists = await Material.exists({ _id: materialId });
    if (!materialExists) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Get student with redeemed codes
    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const now = new Date();
    let hasAccess = false;

    // Check each redemption for valid access
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        materials: materialId,
        codes: {
          $elemMatch: {
            value: redemption.code,
            isUsed: true,
          },
        },
      })
        .select('_id')
        .lean();

      if (codesGroup) {
        hasAccess = true;
        break;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        message: 'No valid access to this material',
      });
    }

    // Implement pagination
    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    // Get total number of questions for pagination metadata
    const totalQuestions = await Question.countDocuments({
      material: materialId,
    });

    // Retrieve questions with pagination
    const questions = await Question.find({ material: materialId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt') // Exclude unnecessary fields
      .populate('material', 'name'); // Populate material details

    res.status(200).json({
      docs: questions,
      totalDocs: totalQuestions,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalQuestions / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleQuestions:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Server error',
    });
  }
};
