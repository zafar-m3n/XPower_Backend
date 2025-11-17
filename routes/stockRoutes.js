// routes/stockRoutes.js
const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const { getWarehousesForProduct, createStockOut } = require("../controllers/stockController");

/**
 * @route   GET /api/v1/stock/product/:productId/warehouses
 * @desc    Get all warehouses that have this product, with available quantity
 * @access  Private (JWT)
 *
 * Used by the frontend after selecting a product:
 * - Product is selected first
 * - This returns a list of warehouses + stock for that product
 */
router.get("/product/:productId/warehouses", authenticate, getWarehousesForProduct);

/**
 * @route   POST /api/v1/stock/out
 * @desc    Create a stock-out transaction for a single product,
 *          potentially spanning multiple warehouses in one request.
 * @access  Private (JWT)
 *
 * Expected body:
 * {
 *   "productId": 123,
 *   "transactionDate": "2025-11-17",
 *   "reference_no": "INV-1001",         // optional
 *   "remarks": "Sold to customer X",    // optional
 *   "lines": [
 *     { "warehouseId": 1, "quantity": 5 },
 *     { "warehouseId": 2, "quantity": 3 }
 *   ]
 * }
 */
router.post("/out", authenticate, createStockOut);

module.exports = router;
