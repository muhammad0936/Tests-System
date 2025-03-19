const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const Student = require('../../models/Student');
const { body, validationResult } = require('express-validator');
const College = require('../../models/College');
const University = require('../../models/University');
//[[[[[[[]]]]]]]
// Student signup validation middleware
const validateSignup = [
  body('fname')
    .trim()
    .notEmpty()
    .withMessage('الاسم الأول مطلوب.')
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول الاسم أقل من 50 حرفاً.'),

  body('lname')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول اسم العائلة أقل من 50 حرفاً.'),

  body('email')
    .trim()
    .optional()
    .isEmail()
    .withMessage('صيغة البريد الإلكتروني غير صحيحة.')
    .normalizeEmail(),

  body('password').trim().notEmpty().withMessage('كلمة المرور مطلوبة.'),
  body('phone').trim().notEmpty().withMessage('رقم الهاتف مطلوب.'),
  body('university')
    .notEmpty()
    .withMessage('معرف الجامعة مطلوب.')
    .isMongoId()
    .withMessage('معرف الجامعة غير صالح.'),
  body('college')
    .notEmpty()
    .withMessage('معرف الكلية مطلوب.')
    .isMongoId()
    .withMessage('معرف الكلية غير صالح.'),
  body('year')
    .isInt({ min: 0, max: 6 })
    .withMessage('يجب أن تكون السنة الأكاديمية بين 0 و 6.'),

  body('image.url')
    .optional()
    .isURL()
    .withMessage('صيغة رابط الصورة غير صحيحة.'),

  body('image.publicId')
    .optional()
    .isString()
    .withMessage('صيغة المعرف العام غير صحيحة.'),
];

// Student login validation middleware
const validateLogin = [
  body('phone').trim().notEmpty().withMessage('رقم الهاتف مطلوب.'),
  body('password').trim().notEmpty().withMessage('كلمة المرور مطلوبة.'),
];

exports.signup = [
  ...validateSignup,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const {
        fname,
        lname,
        email,
        password,
        phone,
        university,
        college,
        year,
        image,
      } = req.body;

      // Validate required fields
      if (!fname || !lname || !year) {
        const error = new Error('الاسم الأول واسم العائلة والسنة مطلوبة!');
        error.statusCode = StatusCodes.BAD_REQUEST;
        throw error;
      }
      const universityExists = await University.exists({ _id: university });
      if (!universityExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الجامعة.' });
      }
      const loadedCollege = await College.findOne({ _id: college });
      if (!loadedCollege)
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الكلية.' });
      if (loadedCollege.university.toString() !== university)
        return res.status(400).json({
          message: 'الكلية المقدمة لا تنتمي إلى الجامعة المقدمة!',
        });
      if (loadedCollege.numOfYears < year)
        return res.status(400).json({
          message: `الكلية تحتوي فقط على ${loadedCollege.numOfYears} سنوات، وقد اخترت ${year}.`,
        });
      const emailExists = await Student.exists({ email });
      if (emailExists) {
        const error = new Error('البريد الإلكتروني موجود بالفعل!');
        error.statusCode = StatusCodes.BAD_REQUEST;
        throw error;
      }

      const existingStudent = await Student.findOne({ phone });
      if (existingStudent) {
        const error = new Error('رقم الهاتف موجود بالفعل!');
        error.statusCode = StatusCodes.BAD_REQUEST;
        throw error;
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      // Create new student
      const student = new Student({
        fname,
        lname,
        email,
        phone,
        password: hashedPassword,
        year,
        image: image || { url: '', publicId: '' },
        university,
        college,
      });
      await student.save();
      const token = jwt.sign(
        {
          userId: student._id,
          phone: student.phone,
          role: 'student',
        },
        'thisismysecretkey',
        { expiresIn: '30d' }
      );
      res.status(StatusCodes.CREATED).json({
        message: 'تم تسجيل الطالب بنجاح.',
        token: `Bearer ${token}`,
      });
    } catch (err) {
      if (!err.statusCode) err.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      next(err);
    }
  },
];

exports.login = [
  ...validateLogin,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { phone, password } = req.body;
      const loadedStudent = await Student.findOne({ phone })
        .select('+password')
        .lean();

      if (!loadedStudent) {
        const error = new Error('بيانات الاعتماد غير صالحة!');
        error.statusCode = StatusCodes.UNAUTHORIZED;
        throw error;
      }

      const isEqual = await bcrypt.compare(password, loadedStudent.password);
      if (!isEqual) {
        const error = new Error('بيانات الاعتماد غير صالحة!');
        error.statusCode = StatusCodes.UNAUTHORIZED;
        throw error;
      }

      const token = jwt.sign(
        {
          userId: loadedStudent._id,
          phone: loadedStudent.phone,
          role: 'student',
        },
        'thisismysecretkey',
        { expiresIn: '30d' }
      );

      res.status(StatusCodes.OK).json({
        message: 'تم تسجيل الدخول بنجاح.',
        token: `Bearer ${token}`,
      });
    } catch (error) {
      if (!error.statusCode)
        error.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      next(error);
    }
  },
];
