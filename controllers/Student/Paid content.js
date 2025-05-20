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
const CourseFile = require('../../models/CourseFile');

// Get Universities with Accessible Materials
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
      }).select('materialsWithQuestions materialsWithLectures');

      if (codesGroup) {
        codesGroup.materialsWithQuestions.forEach((id) =>
          materialIds.add(id.toString())
        );
        codesGroup.materialsWithLectures.forEach((id) =>
          materialIds.add(id.toString())
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
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

// Get Accessible Colleges by University
exports.getAccessibleCollegesByUniversity = async (req, res) => {
  try {
    const { page = 1, limit = 10, university } = req.query;

    if (!mongoose.Types.ObjectId.isValid(university)) {
      return res.status(400).json({ message: 'صيغة معرف الجامعة غير صالحة.' });
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
      }).select('materialsWithQuestions materialsWithLectures');

      if (codesGroup) {
        codesGroup.materialsWithQuestions.forEach((id) =>
          materialIds.add(id.toString())
        );
        codesGroup.materialsWithLectures.forEach((id) =>
          materialIds.add(id.toString())
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
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

// Get Accessible Materials
exports.getAccessibleMaterials = async (req, res) => {
  try {
    const { college, year = 1 } = req.query;

    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
    const questionMaterialIds = new Set();
    const lectureMaterialIds = new Set();

    // Separate materials into question and lecture categories
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        'codes.value': redemption.code,
        'codes.isUsed': true,
      }).select('materialsWithQuestions materialsWithLectures');

      if (codesGroup) {
        codesGroup.materialsWithQuestions.forEach((id) =>
          questionMaterialIds.add(id.toString())
        );
        codesGroup.materialsWithLectures.forEach((id) =>
          lectureMaterialIds.add(id.toString())
        );
      }
    }

    // Convert to arrays of ObjectIds
    const questionIdsArray = Array.from(questionMaterialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const lectureIdsArray = Array.from(lectureMaterialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    // Common filter for college and year
    const baseFilter = { college, year };

    // Fetch materials in parallel
    const [materialsWithQuestions, materialsWithLectures] = await Promise.all([
      Material.find({ ...baseFilter, _id: { $in: questionIdsArray } })
        .populate({ path: 'college', select: 'name' })
        .select('-__v -createdAt -updatedAt')
        .lean(),

      Material.find({ ...baseFilter, _id: { $in: lectureIdsArray } })
        .populate({ path: 'college', select: 'name' })
        .select('-__v -createdAt -updatedAt')
        .lean(),
    ]);

    res.status(200).json({
      materialsWithQuestions,
      materialsWithLectures,
      count: {
        questions: materialsWithQuestions.length,
        lectures: materialsWithLectures.length,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};
// Get Accessible Questions
exports.getAccessibleQuestions = async (req, res) => {
  try {
    const { limit = 10, page = 1, material } = req.query;
    const studentId = req.userId;

    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
    }

    const materialId = new mongoose.Types.ObjectId(material);
    const student = await Student.findById(studentId)
      .select('redeemedCodes favorites')
      .lean();

    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
    const redemptionQueries = student.redeemedCodes.map((redemption) => ({
      _id: redemption.codesGroup,
      expiration: { $gt: now },
      materialsWithQuestions: materialId,
      codes: {
        $elemMatch: { value: redemption.code, isUsed: true },
      },
    }));

    const hasAccess =
      redemptionQueries.length > 0
        ? await CodesGroup.exists({ $or: redemptionQueries })
        : false;

    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: 'ليس لديك صلاحية الوصول لهذه المادة.' });
    }

    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    const questions = await Question.find({ material: materialId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'material', select: 'name' })
      .lean();

    const enhancedQuestions = questions.map((questionGroup) => ({
      ...questionGroup,
      questions: questionGroup.questions.map((q, i) => ({
        ...q,
        isFavorite: student.favorites.some(
          (f) => f.questionGroup.equals(questionGroup._id) && f.index === i
        ),
      })),
    }));

    res.status(200).json({
      docs: enhancedQuestions,
      totalDocs: enhancedQuestions.length,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(enhancedQuestions.length / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleQuestions:', err);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

// Get Accessible Courses by Material
exports.getAccessibleCoursesByMaterial = async (req, res) => {
  try {
    const { limit = 10, page = 1, material } = req.query;
    const studentId = req.userId;

    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
    }

    const materialId = new mongoose.Types.ObjectId(material);
    const student = await Student.findById(studentId).select('redeemedCodes');

    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
    const accessibleCodesGroups = await CodesGroup.find({
      _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
      expiration: { $gt: now },
      codes: {
        $elemMatch: {
          value: { $in: student.redeemedCodes.map((rc) => rc.code) },
          isUsed: true,
        },
      },
    })
      .select('courses')
      .populate('courses');

    const courseIds = accessibleCodesGroups.flatMap((group) => group.courses);
    const filteredCourses = courseIds.filter(
      (course) => course.material && course.material.equals(materialId)
    );

    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    res.status(200).json({
      docs: filteredCourses.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
      totalDocs: filteredCourses.length,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(filteredCourses.length / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleCoursesByMaterial:', err);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

// Get Question Group with Question
exports.getQuestionGroupWithQuestion = async (req, res) => {
  try {
    const { questionGroupId, questionIndex } = req.query;
    const studentId = req.userId;

    if (!questionGroupId || !questionIndex) {
      return res
        .status(400)
        .json({ message: 'معرف المجموعة وفهرس السؤال مطلوبان.' });
    }
    if (!mongoose.Types.ObjectId.isValid(questionGroupId)) {
      return res.status(400).json({ message: 'صيغة معرف المجموعة غير صالحة.' });
    }
    if (isNaN(questionIndex) || questionIndex < 0) {
      return res
        .status(400)
        .json({ message: 'فهرس السؤال يجب أن يكون عدداً صحيحاً غير سالب.' });
    }

    const [student, questionGroup] = await Promise.all([
      Student.findById(studentId).select('redeemedCodes favorites').lean(),
      QuestionGroup.findById(questionGroupId)
        .select('paragraph images questions material')
        .lean(),
    ]);

    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }
    if (!questionGroup) {
      return res.status(404).json({ message: 'لم يتم العثور على المجموعة.' });
    }
    if (questionIndex >= questionGroup.questions.length) {
      return res.status(400).json({ message: 'فهرس السؤال خارج النطاق.' });
    }

    const hasAccess = await CodesGroup.exists({
      _id: { $in: student.redeemedCodes.map((r) => r.codesGroup) },
      expiration: { $gt: new Date() },
      materialsWithQuestions: questionGroup.material,
      'codes.value': { $in: student.redeemedCodes.map((r) => r.code) },
      'codes.isUsed': true,
    });

    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: 'ليس لديك صلاحية الوصول لهذه المجموعة.' });
    }

    const favoriteMap = new Map(
      student.favorites.map((fav) => [
        `${fav.questionGroup}_${fav.index}`,
        true,
      ])
    );

    const selectedQuestion = {
      ...questionGroup.questions[questionIndex],
      isFavorite: favoriteMap.has(`${questionGroupId}_${questionIndex}`),
    };

    const response = {
      ...questionGroup,
      questions: [selectedQuestion],
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('Error in getQuestionGroupWithQuestion:', err);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

// Get Accessible Videos by Course
exports.getAccessibleVideosByCourse = async (req, res) => {
  try {
    const { limit = 10, page = 1, course } = req.query;
    const studentId = req.userId;

    if (!course) {
      return res.status(400).json({ message: 'معرف الدورة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(course)) {
      return res.status(400).json({ message: 'صيغة معرف الدورة غير صالحة.' });
    }

    const courseId = new mongoose.Types.ObjectId(course);
    const student = await Student.findById(studentId).select('redeemedCodes');

    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
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
    });

    if (accessibleCodesGroups.length === 0) {
      return res
        .status(403)
        .json({ message: 'ليس لديك صلاحية الوصول لهذه الدورة.' });
    }

    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    const totalVideos = await Video.countDocuments({ course: courseId });
    const videos = await Video.find({ course: courseId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt')
      .populate('course', 'name');

    res.status(200).json({
      docs: videos,
      totalDocs: totalVideos,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalVideos / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleVideosByCourse:', err);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

// Get Course Files with Access Verification
exports.getCourseFiles = async (req, res) => {
  try {
    const { course } = req.params;
    const studentId = req.userId;

    // Validate course ID
    if (!course || !mongoose.Types.ObjectId.isValid(course)) {
      return res.status(400).json({ message: 'معرف الدورة غير صالح.' });
    }

    const courseId = new mongoose.Types.ObjectId(course);

    // Get student with redeemed codes
    const student = await Student.findById(studentId)
      .select('redeemedCodes')
      .lean();

    if (!student) {
      return res.status(404).json({ message: 'لم يتم العثور على الطالب.' });
    }

    // Check course access
    let hasAccess = false;
    const now = new Date();

    if (student.redeemedCodes.length > 0) {
      const accessCheck = await CodesGroup.findOne({
        courses: courseId,
        expiration: { $gt: now },
        _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
        codes: {
          $elemMatch: {
            value: { $in: student.redeemedCodes.map((rc) => rc.code) },
            isUsed: true,
          },
        },
      });

      hasAccess = !!accessCheck;
    }

    // Get course files sorted by num
    const courseFiles = await CourseFile.find({ course: courseId })
      .sort({ num: 1 })
      .lean();

    // Format response based on access
    const formattedFiles = courseFiles.map((file) => ({
      _id: file._id,
      num: file.num,
      course: file.course,
      file: {
        filename: file.file.filename,
        ...(hasAccess && { accessUrl: file.file.accessUrl }),
      },
      createdAt: file.createdAt,
    }));

    res.status(200).json({
      hasAccess,
      files: formattedFiles,
    });
  } catch (err) {
    console.error('Error in getCourseFiles:', err);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};
