const express = require('express');
const router = express.Router();
const isAuth = require('../middlewares/isAuth');
const multerMiddleware = require('../middlewares/multerWithFiles');
const multerGlobal = require('../middlewares/multerGlobal');
const { createAdmin, login } = require('../controllers/Admin/Auth');
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
} = require('../controllers/Admin/Material');
const {
  createQuestion,
  getQuestions,
  deleteQuestion,
} = require('../controllers/Admin/Question');
const {
  createTeacher,
  getTeachers,
  deleteTeacher,
} = require('../controllers/Admin/Teacher');
const {
  createCourse,
  getCourses,
  deleteCourse,
} = require('../controllers/Admin/Course');
const {
  createVideo,
  getVideos,
  deleteVideo,
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

router.post('/admin', multerGlobal, createAdmin);
router.post('/login', multerGlobal, login);

router.post('/university', multerGlobal, isAuth, createUniversity);
router.put('/university/:id', multerGlobal, isAuth, updateUniversity);
router.get('/universities', multerGlobal, isAuth, getUniversities);
router.get('/university/:id', multerGlobal, isAuth, getUniversityById);
router.delete('/university/:id', multerGlobal, isAuth, deleteUniversity);

router.post('/college', multerGlobal, isAuth, createCollege);
router.put('/college/:id', multerGlobal, isAuth, updateCollege);
router.get('/colleges', multerGlobal, isAuth, getColleges);
router.get('/college/:id', multerGlobal, isAuth, getCollegeById);
router.delete('/college/:id', multerGlobal, isAuth, deleteCollege);

router.post('/material', multerGlobal, isAuth, createMaterial);
router.get('/materials', multerGlobal, isAuth, getMaterials);
router.delete('/material/:id', multerGlobal, isAuth, deleteMaterial);

router.post('/question', multerGlobal, isAuth, createQuestion);
router.get('/questions', multerGlobal, isAuth, getQuestions);
router.delete('/question/:id', multerGlobal, isAuth, deleteQuestion);

router.post('/teacher', multerGlobal, isAuth, createTeacher);
router.get('/teachers', multerGlobal, isAuth, getTeachers);
router.delete('/teacher/:id', multerGlobal, isAuth, deleteTeacher);

router.post('/course', multerGlobal, isAuth, createCourse);
router.get('/courses', multerGlobal, isAuth, getCourses);
router.delete('/course/:id', multerGlobal, isAuth, deleteCourse);

router.post('/video', multerGlobal, isAuth, createVideo);
router.get('/videos', multerGlobal, isAuth, getVideos);
router.delete('/video/:id', multerGlobal, isAuth, deleteVideo);

router.post('/codesGroup', multerGlobal, isAuth, createCodesGroup);
router.get('/codesGroups', multerGlobal, isAuth, getCodesGroups);
router.get('/codes/:id', multerGlobal, isAuth, getCodesFromGroup);
router.delete('/codesGroup/:id', multerGlobal, isAuth, deleteCodesGroup);
router.get('/codesGroup/:id/export-pdf', multerGlobal, exportCodeCardsPDF);

router.post('/changeFreeQuestions', multerGlobal, isAuth, copyQuestionsToFree);

module.exports = router;
