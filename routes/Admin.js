const express = require('express');
const router = express.Router();
const isAuth = require('../middlewares/isAuth');
const multerMiddleware = require('../middlewares/multerWithFiles');
const multerGlobal = require('../middlewares/multerGlobal');
const {
  createAdmin,
  login,
  updatePassword,
} = require('../controllers/Admin/Auth');
const {
  createUniversity,
  getUniversities,
  getUniversityById,
  deleteUniversity,
  updateUniversity,
} = require('../controllers/Admin/University');
const {
  createCollege,
  getColleges,
  getCollegeById,
  deleteCollege,
  updateCollege,
} = require('../controllers/Admin/College');
const {
  createMaterial,
  getMaterials,
  deleteMaterial,
  updateMaterial,
} = require('../controllers/Admin/Material');

const {
  createTeacher,
  getTeachers,
  deleteTeacher,
} = require('../controllers/Admin/Teacher');
const {
  createCourse,
  getCourses,
  deleteCourse,
  updateCourse,
} = require('../controllers/Admin/Course');
const {
  createVideo,
  getVideos,
  deleteVideo,
  updateVideo,
} = require('../controllers/Admin/Video');
const {
  createCodesGroup,
  getCodesGroups,
  deleteCodesGroup,
  getCodesFromGroup,
  exportCodesPDF,
  exportCodeCardsPDF,
} = require('../controllers/Admin/CodesGroup');
const { copyQuestionsToFree } = require('../controllers/Admin/FreeQuestion');
const {
  createQuestionGroup,
  getQuestionGroups,
  deleteQuestionGroup,
  deleteQuestion,
  updateQuestion,
  updateQuestionGroup,
} = require('../controllers/Admin/Question');
const { addVideo } = require('../controllers/Admin/UploadVideo');
const BunnyVideoUploader = require('../middlewares/BunnyVideoUpload');
const { uploadImage } = require('../controllers/Admin/UploadImage');
const BunnyImageUploader = require('../middlewares/BunnyImageUpload');
const { getTeachersStatistics } = require('../controllers/Admin/Statistics');
const {
  sendNotificationToAllStudents,
} = require('../controllers/Admin/Notification');
const {
  createSellCenter,
  deleteSellCenter,
  updateSellCenter,
} = require('../controllers/Admin/SellCenter');
const {
  getStudents,
  blockStudent,
  checkBlockedStatus,
} = require('../controllers/Admin/Student');
const {
  createLecture,
  deleteLecture,
  getLecturesByMaterial,
  updateLecture,
} = require('../controllers/Admin/Lecture');
const {
  createCourseFile,
  getCourseFilesByCourse,
  deleteCourseFile,
} = require('../controllers/Admin/CourseFile');

router.post('/addVideo', addVideo);
router.post('/uploadImage', BunnyImageUploader, uploadImage);
router.post('/admin', isAuth, multerGlobal, createAdmin);
router.post('/login', multerGlobal, login);
router.post('/updatePassword', isAuth, multerGlobal, updatePassword);

router.get('/students', multerGlobal, isAuth, getStudents);
router.put('/toggleBlock/:id', multerGlobal, isAuth, blockStudent);
router.get('/checkBlock/:id', multerGlobal, isAuth, checkBlockedStatus);

router.post('/university', multerGlobal, isAuth, createUniversity);
router.put('/university/:id', multerGlobal, isAuth, updateUniversity);
router.get('/universities', multerGlobal, getUniversities);
router.get('/university/:id', multerGlobal, getUniversityById);
router.delete('/university/:id', multerGlobal, isAuth, deleteUniversity);

router.post('/college', multerGlobal, isAuth, createCollege);
router.put('/college/:id', multerGlobal, isAuth, updateCollege);
router.get('/colleges', multerGlobal, getColleges);
router.get('/college/:id', multerGlobal, getCollegeById);
router.delete('/college/:id', multerGlobal, isAuth, deleteCollege);

router.post('/material', multerGlobal, isAuth, createMaterial);
router.get('/materials', multerGlobal, isAuth, getMaterials);
router.put('/material/:id', multerGlobal, isAuth, updateMaterial);
router.delete('/material/:id', multerGlobal, isAuth, deleteMaterial);

router.post('/lecture', multerGlobal, isAuth, createLecture);
router.get(
  '/lectures/:materialId',
  multerGlobal,
  isAuth,
  getLecturesByMaterial
);
router.put('/lecture/:id', multerGlobal, isAuth, updateLecture);
router.delete('/lecture/:id', multerGlobal, isAuth, deleteLecture);

router.post('/questions', multerGlobal, isAuth, createQuestionGroup);
router.get('/questions', multerGlobal, isAuth, getQuestionGroups);
router.put('/questionGroup/:id', multerGlobal, isAuth, updateQuestionGroup);
router.delete('/question/:id', multerGlobal, isAuth, deleteQuestionGroup); // Delete a question
router.delete(
  '/question/:questionGroupId/:questionIndex',
  multerGlobal,
  isAuth,
  deleteQuestion
);

// Edit inner question
router.put(
  '/question/:questionGroupId/:questionIndex',
  multerGlobal,
  isAuth,
  updateQuestion
);

router.post('/teacher', multerGlobal, isAuth, createTeacher);
router.get('/teachers', multerGlobal, isAuth, getTeachers);
router.delete('/teacher/:id', multerGlobal, isAuth, deleteTeacher);

router.post('/course', multerGlobal, isAuth, createCourse);
router.get('/courses', multerGlobal, isAuth, getCourses);
router.put('/course/:id', multerGlobal, isAuth, updateCourse);
router.delete('/course/:id', multerGlobal, isAuth, deleteCourse);

router.post('/courseFile', multerGlobal, isAuth, createCourseFile);
router.get(
  '/courseFiles/:courseId',
  multerGlobal,
  isAuth,
  getCourseFilesByCourse
);
router.delete('/courseFile/:id', multerGlobal, isAuth, deleteCourseFile);

router.post('/video', multerGlobal, isAuth, createVideo);
router.get('/videos', multerGlobal, isAuth, getVideos);
router.put('/video/:id', multerGlobal, isAuth, updateVideo);
router.delete('/video/:id', multerGlobal, isAuth, deleteVideo);

router.post('/codesGroup', multerGlobal, isAuth, createCodesGroup);
router.get('/codesGroups', multerGlobal, isAuth, getCodesGroups);
router.get('/codes/:id', multerGlobal, isAuth, getCodesFromGroup);
router.delete('/codesGroup/:id', multerGlobal, isAuth, deleteCodesGroup);
router.get('/codesGroup/:id/export-pdf', multerGlobal, exportCodeCardsPDF);

router.post('/changeFreeQuestions', multerGlobal, isAuth, copyQuestionsToFree);
router.get('/teachersStatistics', multerGlobal, isAuth, getTeachersStatistics);

router.post('/sendNotification', isAuth, sendNotificationToAllStudents);

router.post('/sellCenter', isAuth, createSellCenter);
router.put('/sellCenter/:id', isAuth, updateSellCenter);
router.delete('/sellCenter/:id', isAuth, deleteSellCenter);

module.exports = router;
