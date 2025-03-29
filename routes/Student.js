const express = require('express');
const router = express.Router();
const isAuth = require('../middlewares/isAuth');
const multerMiddleware = require('../middlewares/multerWithFiles');
const multerGlobal = require('../middlewares/multerGlobal');
const {
  signup,
  login,
  deleteAccount,
  sendOtp,
} = require('../controllers/Student/Auth');
const { redeemCode } = require('../controllers/Student/Code');
const { getFreeMaterials } = require('../controllers/Student/FreeMaterial');
const { getFreeQuestions } = require('../controllers/Student/FreeQuestion');
const {
  getAccessibleMaterials,
  getUniversitiesWithAccessibleMaterials,
  getAccessibleCollegesByUniversity,
  getAccessibleQuestions,
  getAccessibleCoursesByMaterial,
  getAccessibleVideosByCourse,
} = require('../controllers/Student/Paid content');
const {
  getFreeCourses,
  getFreeVideos,
} = require('../controllers/Student/FreeCourse');
const { getProfile, updateProfile } = require('../controllers/Student/Profile');
const { getResolutions } = require('../controllers/Student/Files');
const {
  addFavoriteQuestionGroup,
  getFavoriteQuestionGroups,
  removeFavoriteQuestionGroup,
} = require('../controllers/Student/Favorite');
const { updateFcmToken } = require('../controllers/Student/FcmToken');
router.post('/otp', sendOtp);
router.post('/signup', signup);
router.post('/login', login);
router.put('/fcmToken', isAuth, updateFcmToken);
router.delete('/deleteAccount', isAuth, deleteAccount);

router.post('/redeemCode', isAuth, redeemCode);

router.get('/freeMaterials', isAuth, getFreeMaterials);
router.get('/freeQuestions', isAuth, getFreeQuestions);
router.get('/freeCourses', isAuth, getFreeCourses),
  router.get('/freeVideos', isAuth, getFreeVideos);

router.get('/universities', isAuth, getUniversitiesWithAccessibleMaterials);
router.get('/colleges', isAuth, getAccessibleCollegesByUniversity);
router.get('/materials', isAuth, getAccessibleMaterials);
router.get('/questions', isAuth, getAccessibleQuestions);
router.get('/courses', isAuth, getAccessibleCoursesByMaterial);
router.get('/videos', isAuth, getAccessibleVideosByCourse);
router.get('/resolutions', getResolutions);

router.get('/profile', isAuth, getProfile);
router.put('/profile', isAuth, updateProfile);

router.post('/favorites', isAuth, addFavoriteQuestionGroup);
router.delete('/favorites', isAuth, removeFavoriteQuestionGroup);
router.get('/favorites', isAuth, getFavoriteQuestionGroups);

module.exports = router;
