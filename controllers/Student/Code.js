const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Student = require('../../models/Student');

exports.redeemCode = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('code is required')
    .isLength({ min: 12, max: 12 })
    .withMessage('code must be 12 characters'),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { code } = req.body;
      const studentId = req.userId;

      // 1. Find the code in CodesGroups
      const codesGroup = await CodesGroup.findOne(
        { 'codes.value': code },
        { 'codes.$': 1, expiration: 1, materials: 1, courses: 1 }
      ).session(session);

      if (!codesGroup) {
        return res.status(404).json({ error: 'Code not found' });
      }

      // 2. Check code status and expiration
      const targetCode = codesGroup.codes[0];
      if (targetCode.isUsed) {
        return res.status(400).json({ error: 'Code already used' });
      }

      if (new Date() > codesGroup.expiration) {
        return res.status(400).json({ error: 'Codes group has expired' });
      }

      // 3. Check student hasn't redeemed from this group
      const student = await Student.findById(studentId)
        .session(session)
        .select('redeemedCodes');
      if (!student) return res.status(401).json({ message: 'Unauthorized!' });

      const existingRedemption = student.redeemedCodes?.some((redemption) =>
        redemption?.codesGroup?.equals(codesGroup._id)
      );

      if (existingRedemption) {
        return res.status(409).json({
          error: 'Already redeemed code from this group',
        });
      }

      // 4. Update code status and student record
      await CodesGroup.updateOne(
        { _id: codesGroup._id, 'codes.value': code },
        { $set: { 'codes.$.isUsed': true } }
      ).session(session);

      const newRedemption = {
        code,
        codesGroup: codesGroup._id,
        redeemedAt: new Date(),
      };

      await Student.updateOne(
        { _id: studentId },
        { $push: { redeemedCodes: newRedemption } }
      ).session(session);

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        message: 'Code redeemed successfully',
        data: {
          code,
          materials: codesGroup.materials,
          courses: codesGroup.courses,
          expiration: codesGroup.expiration,
        },
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  },
];
