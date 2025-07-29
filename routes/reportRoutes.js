const express = require("express");
const router = express.Router();

const { lowStockReport, dashboardStats } = require("../controllers/reportController");
const authenticate = require("../middlewares/authMiddleware");

// @route   GET /api/v1/reports/low-stock
// @desc    Get list of products with low stock
router.get("/low-stock", authenticate, lowStockReport);

// @route   GET /api/v1/reports/dashboard
// @desc    Get dashboard summary stats
router.get("/dashboard", authenticate, dashboardStats);

module.exports = router;
