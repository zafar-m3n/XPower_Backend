const express = require("express");
const router = express.Router();

const {
  dashboardStats,
  lowStockReport,
  stockByWarehouseReport,
  outOfStockReport,
  generateReportPDF,
} = require("../controllers/reportController");

const authenticate = require("../middlewares/authMiddleware");

// @route   GET /api/v1/reports/dashboard
// @desc    Get dashboard summary stats
router.get("/dashboard", authenticate, dashboardStats);

// @route   GET /api/v1/reports/low-stock
// @desc    Get list of products with low stock
router.get("/low-stock", authenticate, lowStockReport);

// @route   GET /api/v1/reports/stock-by-warehouse
// @desc    Get stock summary grouped by warehouse
router.get("/stock-by-warehouse", authenticate, stockByWarehouseReport);

// @route   GET /api/v1/reports/out-of-stock
// @desc    Get all products with zero stock across all warehouses
router.get("/out-of-stock", authenticate, outOfStockReport);

// @route   GET /api/v1/reports/pdf/:type
// @desc    Generate PDF for the given report type (server-side)
router.get("/pdf/:type", authenticate, generateReportPDF);

module.exports = router;
