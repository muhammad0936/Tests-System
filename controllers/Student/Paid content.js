const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Material = require('../../models/Material');
const Student = require('../../models/Student');
const College = require('../../models/College');
const University = require('../../models/University');
const Question = require('../../models/QuestionGroup');
const Course = require('../../models/Course');
const Video = require('../../models/Video');
const QuestionGroup = require('../../models/QuestionGroup');

//[[[[[[[[[[[]]]]]]]]]]]
exports.getUniversitiesWithAccessibleMaterials = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
    const materialIds = new Set();

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

    const materials = await Material.find({ _id: { $in: materialIdsArray } })
      .select('college')
      .lean();

    const collegeIds = [
      ...new Set(materials.map((m) => m.college.toString())),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const colleges = await College.find({ _id: { $in: collegeIds } })
      .select('university')
      .lean();

    const universityIds = [
      ...new Set(colleges.map((c) => c.university.toString())),
    ].map((id) => new mongoose.Types.ObjectId(id));

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
    console.error(err.message);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};

//[[[[[[[[[[[]]]]]]]]]]]

exports.getAccessibleCollegesByUniversity = async (req, res) => {
  try {
    const { page = 1, limit = 10, university } = req.query;

    if (!mongoose.Types.ObjectId.isValid(university)) {
      return res.status(400).json({ message: 'صيغة معرف الجامعة غير صالحة.' });
    }

    const universityExists = await University.exists({ _id: university });
    if (!universityExists) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الجامعة.' });
    }

    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
    const materialIds = new Set();

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

    const collegeIds = await Material.distinct('college', {
      _id: { $in: materialIdsArray },
    });

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
    console.error(err.message);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};

//[[[[[[[[[[[]]]]]]]]]]]
exports.getAccessibleMaterials = async (req, res) => {
  try {
    const { page = 1, limit = 10, college, year = 1 } = req.query;

    // Fetch student with redeemed codes
    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }
    if (!college) {
      return res.status(400).json({ message: 'يرجى تقديم معرف الكلية!' });
    }
    const loadedCollege = await College.findById(college);
    if (!loadedCollege) {
      return res.status(400).json({ message: 'معرف الكلية غير صالح.' });
    }
    if (!year || loadedCollege.numOfYears < year || year < 1)
      return res.status(400).json({
        message: `يرجى اختيار السنة الأكاديمية بين 1 و ${loadedCollege.numOfYears} `,
      });
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
      { _id: { $in: materialIdsArray }, college, year },
      {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: { path: 'college', select: 'name' },
        select: '-__v -createdAt -updatedAt',
      }
    );

    res.status(200).json(materials);
  } catch (err) {
    console.error(err.message);
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

exports.getAccessibleQuestions = async (req, res) => {
  try {
    const { limit = 10, page = 1, material } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
    }

    // Convert material id and verify material exists
    const materialId = new mongoose.Types.ObjectId(material);

    // Retrieve student with redeemed codes and favorites
    const student = await Student.findById(studentId)
      .select('redeemedCodes favorites')
      .lean();
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    // Build favorites lookup map for constant time checks
    const favoriteMap = new Map();
    student.favorites.forEach((fav) => {
      const key = `${fav.questionGroup}_${fav.index}`;
      favoriteMap.set(key, true);
    });

    const now = new Date();

    // Build an array of redemption queries to check access in one go
    const redemptionQueries = student.redeemedCodes.map((redemption) => ({
      _id: redemption.codesGroup,
      expiration: { $gt: now },
      materials: materialId,
      codes: {
        $elemMatch: { value: redemption.code, isUsed: true },
      },
    }));

    // Check if any redemption gives access using one consolidated query
    let hasAccess = false;
    if (redemptionQueries.length > 0) {
      const codesGroup = await CodesGroup.findOne({ $or: redemptionQueries })
        .select('_id')
        .lean();

      if (codesGroup) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        message: 'ليس لديك صلاحية الوصول لهذه المادة.',
      });
    }

    // Parse pagination parameters
    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    // Retrieve questions with pagination and required population
    const questions = await Question.find({ material: materialId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt')
      .populate({ path: 'material', select: 'name' })
      .lean();

    // Enhance questions: iterate with index to add isFavorite flag efficiently
    const enhancedQuestions = [];
    for (const questionGroup of questions) {
      if (Array.isArray(questionGroup.questions)) {
        const questionsWithFavorites = [];
        for (let i = 0; i < questionGroup.questions.length; i++) {
          const key = `${questionGroup._id.toString()}_${i}`;
          questionsWithFavorites.push({
            ...questionGroup.questions[i],
            isFavorite: favoriteMap.has(key),
          });
        }
        questionGroup.questions = questionsWithFavorites;
      }
      enhancedQuestions.push(questionGroup);
    }
    res.status(200).json({
      docs: enhancedQuestions,
      totalDocs: enhancedQuestions.length,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(enhancedQuestions.length / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleQuestions:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};

exports.getAccessibleCoursesByMaterial = async (req, res) => {
  try {
    const { limit = 10, page = 1, material } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
    }

    // Convert to ObjectId once
    const materialId = new mongoose.Types.ObjectId(material);

    // Verify material exists
    const materialExists = await Material.exists({ _id: materialId });
    if (!materialExists) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على المادة.' });
    }

    // Get student with redeemed codes
    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();

    // Get all codes groups that the student has access to for this material
    const accessibleCodesGroups = await CodesGroup.find({
      _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
      expiration: { $gt: now },
      materials: materialId,
      codes: {
        $elemMatch: {
          value: { $in: student.redeemedCodes.map((rc) => rc.code) },
          isUsed: true,
        },
      },
    })
      .select('_id')
      .populate('courses');
    if (accessibleCodesGroups.length === 0) {
      return res.status(403).json({
        message: 'ليس لديك صلاحية الوصول لهذه المادة.',
      });
    }

    // Implement pagination
    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    // Get total number of accessible courses for pagination metadata
    const totalCourses = await Course.countDocuments({
      material: materialId,
      _id: {
        $in: accessibleCodesGroups.flatMap((group) => group.courses || []),
      },
    });

    // Retrieve accessible courses with pagination
    const courses = await Course.find({
      material: materialId,
      _id: {
        $in: accessibleCodesGroups.flatMap((group) => group.courses || []),
      },
    })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt') // Exclude unnecessary fields
      .populate('material', 'name') // Populate material details
      .populate('teacher', 'fname lname'); // Populate teacher details

    res.status(200).json({
      docs: courses,
      totalDocs: totalCourses,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalCourses / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleCoursesByMaterial:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};

exports.getAccessibleVideosByCourse = async (req, res) => {
  try {
    const { limit = 10, page = 1, course } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!course) {
      return res.status(400).json({ message: 'معرف الدورة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(course)) {
      return res.status(400).json({ message: 'صيغة معرف الدورة غير صالحة.' });
    }

    // Convert to ObjectId once
    const courseId = new mongoose.Types.ObjectId(course);

    // Verify course exists
    const courseExists = await Course.exists({ _id: courseId });
    if (!courseExists) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
    }

    // Get student with redeemed codes
    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();

    // Get all codes groups that the student has access to for this course
    const accessibleCodesGroups = await CodesGroup.find({
      _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
      expiration: { $gt: now },
      courses: courseId,
      codes: {
        $elemMatch: {
          value: { $in: student.redeemedCodes.map((rc) => rc.code) },
          isUsed: true,
        },
      },
    }).select('_id');

    if (accessibleCodesGroups.length === 0) {
      return res.status(403).json({
        message: 'ليس لديك صلاحية الوصول لهذه الدورة.',
      });
    }

    // Implement pagination
    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    // Get total number of accessible videos for pagination metadata
    const totalVideos = await Video.countDocuments({
      course: courseId,
    });

    // Retrieve accessible videos with pagination
    const videos = await Video.find({ course: courseId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt') // Exclude unnecessary fields
      .populate('course', 'name'); // Populate course details

    res.status(200).json({
      docs: videos,
      totalDocs: totalVideos,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalVideos / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleVideosByCourse:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};
exports.getQuestionGroupWithQuestion = async (req, res) => {
  try {
    const { questionGroupId, questionIndex } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!questionGroupId || !questionIndex) {
      return res.status(400).json({
        message: 'معرف المجموعة وفهرس السؤال مطلوبان.',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(questionGroupId)) {
      return res.status(400).json({
        message: 'صيغة معرف المجموعة غير صالحة.',
      });
    }
    if (isNaN(questionIndex) || questionIndex < 0) {
      return res.status(400).json({
        message: 'فهرس السؤال يجب أن يكون عدداً صحيحاً غير سالب.',
      });
    }

    // Parallel fetch of student and question group
    const [student, questionGroup] = await Promise.all([
      Student.findById(studentId).select('redeemedCodes favorites').lean(),
      QuestionGroup.findById(questionGroupId)
        .select('paragraph questions material')
        .lean(),
    ]);

    if (!student) {
      return res.status(404).json({
        message: 'عذراً، لم يتم العثور على الطالب.',
      });
    }
    if (!questionGroup) {
      return res.status(404).json({
        message: 'لم يتم العثور على المجموعة.',
      });
    }
    if (questionIndex >= questionGroup.questions.length) {
      return res.status(400).json({
        message: 'فهرس السؤال خارج النطاق.',
      });
    }

    // Create favorite lookup map
    const favoriteMap = new Map(
      student.favorites.map((fav) => [
        `${fav.questionGroup}_${fav.index}`,
        true,
      ])
    );

    // Check access using single optimized query
    const hasAccess = await CodesGroup.exists({
      _id: { $in: student.redeemedCodes.map((r) => r.codesGroup) },
      expiration: { $gt: new Date() },
      materials: questionGroup.material,
      'codes.value': { $in: student.redeemedCodes.map((r) => r.code) },
      'codes.isUsed': true,
    });

    if (!hasAccess) {
      return res.status(403).json({
        message: 'ليس لديك صلاحية الوصول لهذه المجموعة.',
      });
    }

    // Get the specific question with isFavorite flag
    const selectedQuestion = {
      ...questionGroup.questions[questionIndex],
      isFavorite: favoriteMap.has(`${questionGroupId}_${questionIndex}`),
    };

    // Build response with only the selected question
    const response = {
      ...questionGroup,
      questions: [selectedQuestion],
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('Error in getQuestionGroupWithQuestion:', err);
    res.status(500).json({
      error: 'حدث خطأ في الخادم.',
    });
  }
};
