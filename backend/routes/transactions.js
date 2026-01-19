const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Officer = require('../models/Officer');
const Armoury = require('../models/Armoury');
const Ammunition = require('../models/Ammunition');
const Munition = require('../models/Munition');
const { auth, adminOnly } = require('../middleware/auth');
const { upload, handleMulterError } = require('../middleware/upload');

const router = express.Router();

// Helper to safely convert string IDs to ObjectId
const toObjectIds = (ids) => {
  try {
    return ids.map(id => new mongoose.Types.ObjectId(id.trim()));
  } catch (err) {
    throw new Error('Invalid MongoDB ID format');
  }
};

// @route   GET /api/transactions
// @desc    Get all transactions with filters & pagination
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { type, status, officerId, startDate, endDate, page = 1, limit = 50 } = req.query;

    let query = {};

    if (type) query.transactionType = type;
    if (status) query.status = status;
    if (officerId) query.officerId = officerId;
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const transactions = await Transaction.find(query)
      .populate('officerId', 'name rank metalNo kgidNo')
      .populate('audit.createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/transactions/:id
// @desc    Get single transaction
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID' });
    }

    const transaction = await Transaction.findById(req.params.id)
      .populate('officerId', 'name rank metalNo kgidNo phonenumber')
      .populate('audit.createdBy', 'name')
      .populate('audit.lastModifiedBy', 'name');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/transactions/issue
// @desc    Issue items to officer
// @access  Private (Admin)
// --- UPDATED ISSUE ROUTE ---
router.post('/issue', [auth, adminOnly], async (req, res) => {
  const {
    officerId,
    weaponIds = [],
    ammunitionIds = [],
    munitionIds = [],
    ammunitionCounts = {},
    munitionCounts = {},
    purpose,
    location,
    expectedReturnDate,
    fingerprintData
  } = req.body;

  try {
    const issuedItems = { armoury: [], ammunition: [], munition: [] };

    // 1. PROCESS WEAPONS
    if (weaponIds.length > 0) {
      const weapons = await Armoury.find({ _id: { $in: weaponIds } });
      for (const weapon of weapons) {
        weapon.status = 'issued';
        weapon.currentHolder = officerId;
        await weapon.save();

        issuedItems.armoury.push({
          _id: weapon._id,
          registerNumber: weapon.registerNumber,
          buttNumber: weapon.buttNumber,
          type: weapon.type,
          status: 'issued'
        });
      }
    }

    // 2. PROCESS AMMUNITION
    if (ammunitionIds.length > 0) {
      const ammunitions = await Ammunition.find({ _id: { $in: ammunitionIds } });
      for (const ammo of ammunitions) {
        const qty = Number(ammunitionCounts[ammo._id.toString()] || 0);
        if (qty > 0) {
          ammo.availableCount -= qty;
          ammo.issuedCount += qty;
          await ammo.save();

          issuedItems.ammunition.push({
            _id: ammo._id,
            name: ammo.name,
            caliber: ammo.caliber,
            count: qty,
            status: 'issued'
          });
        }
      }
    }

    // 3. PROCESS MUNITION (The source of your specific error)
    if (munitionIds.length > 0) {
      const munitions = await Munition.find({ _id: { $in: munitionIds } });
      for (const mun of munitions) {
        const qty = Number(munitionCounts[mun._id.toString()] || 0);
        if (qty > 0) {
          mun.availableCount -= qty;
          mun.issuedCount += qty;
          await mun.save();

          issuedItems.munition.push({
            _id: mun._id,
            name: mun.name,
            type: mun.type,
            count: qty,
            status: 'issued',
            batchNumber: mun.batchNumber,
            expiryDate: mun.expiryDate
          });
        }
      }
    }

    // Create the Transaction
    const transaction = new Transaction({
      transactionType: 'issue',
      transactionNumber: `ISS${Date.now()}`, // Or your custom sequence logic
      officerId,
      issuedItems, // CLEAN OBJECTS HERE
      purpose: purpose || 'Duty Assignment',
      location,
      expectedReturnDate,
      audit: { createdBy: req.user.id }
    });

    await transaction.save();
    res.status(201).json({ success: true, data: transaction });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/transactions/return
// @desc    Return items from officer
// @access  Private (Admin)
router.post('/return', [
  auth,
  adminOnly,
  upload.array('documents', 10),
  body('officerId').isMongoId()
], handleMulterError, async (req, res) => {
  try {
    let {
      officerId,
      weaponIds = '[]',
      ammunitionIds = '[]',
      munitionIds = '[]',
      ammunitionCounts = '{}',
      munitionCounts = '{}',
      emptyCases = '{}',
      remarks = '[]',
      fingerprintData
    } = req.body;

    // Parse JSON safely
    const parseSafe = (str, defaultVal) => {
      try { return JSON.parse(str); } catch { return defaultVal; }
    };

    const parsedWeaponIds = parseSafe(weaponIds, []);
    const parsedAmmunitionIds = parseSafe(ammunitionIds, []);
    const parsedMunitionIds = parseSafe(munitionIds, []);
    const parsedAmmoCounts = parseSafe(ammunitionCounts, {});
    const parsedMunCounts = parseSafe(munitionCounts, {});
    const parsedEmptyCases = parseSafe(emptyCases, {});
    const parsedRemarks = parseSafe(remarks, []);

    const officer = await Officer.findById(officerId);
    if (!officer) {
      return res.status(400).json({ success: false, message: 'Officer not found' });
    }

    const returnedItems = { armoury: [], ammunition: [], munition: [] };
    const shortageDetails = []; // you can populate this if needed

    // ── Weapons Return ─────────────────────────────────────────────────
    if (parsedWeaponIds.length > 0) {
      const weaponObjectIds = toObjectIds(parsedWeaponIds);
      const weapons = await Armoury.find({
        _id: { $in: weaponObjectIds },
        currentHolder: officerId
      });

      if (weapons.length !== parsedWeaponIds.length) {
        const found = new Set(weapons.map(w => w._id.toString()));
        const missing = parsedWeaponIds.filter(id => !found.has(id));
        return res.status(400).json({
          success: false,
          message: `Some weapons not found or not held by officer. Missing: ${missing.join(', ')}`
        });
      }

      for (const weapon of weapons) {
        weapon.status = 'available';
        weapon.currentHolder = undefined;
        await weapon.save();

        returnedItems.armoury.push({
          _id: weapon._id,
          registerNumber: weapon.registerNumber,
          buttNumber: weapon.buttNumber,
          type: weapon.type,
          status: 'returned',
          returnTimestamp: new Date(),
          condition: { return: weapon.condition }
        });
      }
    }

   // ── Ammunition Return ──────────────────────────────────────────────
if (parsedAmmunitionIds.length > 0) {
  const ammoObjectIds = toObjectIds(parsedAmmunitionIds);
  const ammunitions = await Ammunition.find({ _id: { $in: ammoObjectIds } });

  for (const ammo of ammunitions) {
    const idStr = ammo._id.toString();
    const returnedQty = Number(parsedAmmoCounts[idStr] || 0);
    const emptyQty = Number(parsedEmptyCases[idStr] || 0);

    if (returnedQty > 0) {
      ammo.availableCount += returnedQty;
      ammo.returnedCount += returnedQty;
      ammo.emptyCasesCount += emptyQty;
      await ammo.save();

      returnedItems.ammunition.push({
        _id: ammo._id,
        name: ammo.name,
        caliber: ammo.caliber,
        count: returnedQty, // FIX 1: Required by schema
        returnedCount: returnedQty,
        emptyCasesReturned: emptyQty,
        status: 'fully_returned', // FIX 2: Must match Enum in schema
        returnTimestamp: new Date()
      });
    }
  }
}

// ── Munition Return ────────────────────────────────────────────────
if (parsedMunitionIds.length > 0) {
  const munitionObjectIds = toObjectIds(parsedMunitionIds);
  const munitions = await Munition.find({ _id: { $in: munitionObjectIds } });

  for (const mun of munitions) {
    const idStr = mun._id.toString();
    const returnedQty = Number(parsedMunCounts[idStr] || 0);
    const emptyQty = Number(parsedEmptyCases[idStr] || 0);

    if (returnedQty > 0) {
      mun.availableCount += returnedQty;
      mun.returnedCount += returnedQty;
      mun.emptyCasesCount += emptyQty;
      await mun.save();

      returnedItems.munition.push({
        _id: mun._id,
        name: mun.name,
        type: mun.type,
        count: returnedQty, 
        returnedCount: returnedQty,
        emptyCasesReturned: emptyQty,
        status: 'fully_returned', // FIX 2: Must match Enum in schema
        returnTimestamp: new Date()
      });
    }
  }
}

    // Documents
    const returnDocuments = req.files?.map(file => ({
      fileName: file.originalname,
      filePath: file.filename,
      fileType: file.mimetype,
      fileSize: file.size,
      description: file.originalname
    })) || [];

    // Create return transaction
    const date = new Date();
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');

const startOfDay = new Date(year, date.getMonth(), date.getDate());
const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);

const count = await Transaction.countDocuments({
  createdAt: { $gte: startOfDay, $lt: endOfDay },
  transactionType: 'return'
});

const sequence = String(count + 1).padStart(4, '0');
const prefix = 'RET';

const transactionNumber = `${prefix}${year}${month}${day}${sequence}`;

    const transaction = new Transaction({
      transactionType: 'return',
      officerId,
      transactionNumber,
      issuedItems: returnedItems, // renamed for clarity
      actualReturnDate: new Date(),
      returnDocuments,
      returnRemarks: parsedRemarks,
      shortageDetails,
      fingerprint: {
        returnFingerprint: fingerprintData,
        verificationStatus: fingerprintData ? 'verified' : 'pending'
      },
      audit: { createdBy: req.user.id }
    });

    await transaction.save();

    await transaction.addAuditAction(
      'RETURN_PROCESSED',
      req.user.id,
      `Items returned by ${officer.name} (${officer.metalNo})`,
      req.ip
    );

    await transaction.populate('officerId', 'name rank metalNo kgidNo');

    res.status(201).json({
      success: true,
      message: 'Items returned successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Return transaction error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @route   GET /api/transactions/officer/:officerId
// @desc    Get transactions for officer
// @access  Private
router.get('/officer/:officerId', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.officerId)) {
      return res.status(400).json({ success: false, message: 'Invalid officer ID' });
    }

    const transactions = await Transaction.find({ officerId: req.params.officerId })
      .populate('officerId', 'name rank metalNo kgidNo')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Get officer transactions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/transactions/stats/overview
// @desc    Transaction statistics
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const stats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          issues: { $sum: { $cond: [{ $eq: ['$transactionType', 'issue'] }, 1, 0] } },
          returns: { $sum: { $cond: [{ $eq: ['$transactionType', 'return'] }, 1, 0] } },
          open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } }
        }
      }
    ]);

    const dailyStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$transactionType'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || { total: 0, issues: 0, returns: 0, open: 0, closed: 0 },
        daily: dailyStats
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;