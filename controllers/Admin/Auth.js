const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { body, param, validationResult } = require('express-validator');

// Models
const Admin = require('../../models/Admin');

exports.createAdmin = [
  // Validate only complex fields
  body('lname').isString().withMessage('lname must be provided as string'),
  body('fname').optional().isString().withMessage('fname must be string'),
  body('password')
    .isString()
    .withMessage('password must be provided as string'),
  body('phone').isNumeric().withMessage('phone must be provided as number'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { fname, lname, phone, password } = req.body;

      const existingAdmin = await Admin.findOne({ phone });
      if (existingAdmin) {
        const error = new Error('This phone already exists!');
        error.statusCode = 400;
        throw error;
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      const admin = new Admin({
        fname,
        lname,
        phone,
        password: hashedPassword,
      });
      await admin.save();
      res.status(201).json({ message: 'Admin added successfully.' });
    } catch (err) {
      if (!err.statusCode && !err[0]) err.statusCode = 500;
      next(err);
    }
  },
];

// Login Admin
exports.login = [
  body('phone').isNumeric().withMessage('phone must be provided as number'),
  body('password')
    .isString()
    .withMessage('password must be provided as string'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { phone, password } = req.body;
      const loadedAdmin = await Admin.findOne({ phone });

      if (!loadedAdmin) {
        const error = new Error('Phone or password is incorrect!');
        error.statusCode = 401;
        throw error;
      }
      const isEqual = await bcrypt.compare(password, loadedAdmin.password);
      if (!isEqual) {
        const error = new Error('Phone or password is incorrect!');
        error.statusCode = 401;
        throw error;
      }
      const token = jwt.sign(
        {
          phone: loadedAdmin.phone,
          userId: loadedAdmin._id,
        },
        'thisismysecretkey',
        { expiresIn: '30d' }
      );
      res
        .status(200)
        .json({ message: 'signed in successfully.', JWT: `Bearer ${token}` });
    } catch (error) {
      if (!error.statusCode && !error[0]) error.statusCode = 500;
      next(error);
    }
  },
];
