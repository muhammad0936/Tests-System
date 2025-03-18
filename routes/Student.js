const express = require('express');
const router = express.Router();
const isAuth = require('../middlewares/isAuth');
const multerMiddleware = require('../middlewares/multerWithFiles');
const multerGlobal = require('../middlewares/multerGlobal');
const { signup, login } = require('../controllers/Student/Auth');
const { redeemCode } = require('../controllers/Student/Code');
const { getFreeMaterials } = require('../controllers/Student/FreeMaterial');
const { getFreeQuestions } = require('../controllers/Student/FreeQuestion');

router.post('/signup', signup);
router.post('/login', login);

router.post('/redeemCode', isAuth, redeemCode);

router.get('/freeMaterials', isAuth, getFreeMaterials);
router.get('/freeQuestions', isAuth, getFreeQuestions);
module.exports = router;
