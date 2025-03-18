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
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters'),

  body('lname')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password').trim().notEmpty().withMessage('Password is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('university')
    .notEmpty()
    .withMessage('University ID is required')
    .isMongoId()
    .withMessage('Invalid University ID'),
  body('college')
    .notEmpty()
    .withMessage('College ID is required')
    .isMongoId()
    .withMessage('Invalid College ID'),
  body('year')
    .isInt({ min: 0, max: 6 })
    .withMessage('Academic year must be between 0 and 6'),

  body('image.url').optional().isURL().withMessage('Invalid image URL format'),

  body('image.publicId')
    .optional()
    .isString()
    .withMessage('Invalid public ID format'),
];

// Student login validation middleware
const validateLogin = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').trim().notEmpty().withMessage('Password is required'),
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
        const error = new Error(
          'First name, last name, and year are required!'
        );
        error.statusCode = StatusCodes.BAD_REQUEST;
        throw error;
      }
      const universityExists = await University.exists({ _id: university });
      if (!universityExists) {
        return res.status(400).json({ message: 'University not found!' });
      }
      const loadedCollege = await College.findOne({ _id: college });
      if (!loadedCollege)
        return res.status(400).json({ message: 'College not found!' });
      if (loadedCollege.university.toString() !== university)
        return res.status(400).json({
          message: 'Provided college is not from provided university!',
        });
      if (loadedCollege.numOfYears < year)
        return res.status(400).json({
          message: `Chosen college has just ${loadedCollege.numOfYears} years, you choosed ${year}`,
        });
      const emailExists = await Student.exists({ email });
      if (emailExists) {
        const error = new Error('Email already exists!');
        error.statusCode = StatusCodes.BAD_REQUEST;
        throw error;
      }

      const existingStudent = await Student.findOne({ phone });
      if (existingStudent?.email) {
        const error = new Error('Phone already exists!');
        error.statusCode = StatusCodes.BAD_REQUEST;
        throw error;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      if (existingStudent) {
        // Update existing student with partial registration
        existingStudent.fname = fname;
        existingStudent.lname = lname;
        existingStudent.email = email;
        existingStudent.password = hashedPassword;
        existingStudent.year = year;
        existingStudent.image = image || existingStudent.image;
        await existingStudent.save();
      } else {
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
      }

      res.status(StatusCodes.CREATED).json({
        message: 'Student registered successfully.',
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
        const error = new Error('Invalid credentials!');
        error.statusCode = StatusCodes.UNAUTHORIZED;
        throw error;
      }

      const isEqual = await bcrypt.compare(password, loadedStudent.password);
      if (!isEqual) {
        const error = new Error('Invalid credentials!');
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
        message: 'Login successful',
        token: `Bearer ${token}`,
      });
    } catch (error) {
      if (!error.statusCode)
        error.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      next(error);
    }
  },
];
