// controllers/stockController.js

const { Op } = require("sequelize");
const { Product, Stock, Warehouse, StockTransaction, User } = require("../models");
const { sequelize } = require("../config/database");
const { resSuccess, resError } = require("../utils/responseUtil");

/**
 * GET /api/products/:productId/warehouses
 *
 * Returns all warehouses that have this product in stock,
 * along with the available quantity in each warehouse.
 *
 * This powers the frontend after the user selects a product:
 * - Product is chosen first
 * - Then we show all warehouses + their stock for that product
 */
const getWarehousesForProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);

    if (!Number.isInteger(productId)) {
      return resError(res, "Invalid product id", 400);
    }

    // Ensure product exists (optional but nicer for the frontend)
    const product = await Product.findByPk(productId);
    if (!product) {
      return resError(res, "Product not found", 404);
    }

    // Find all stock rows for this product, include warehouse info
    const stockRows = await Stock.findAll({
      where: { product_id: productId },
      include: [
        {
          model: Warehouse,
          attributes: ["id", "name", "location"],
        },
      ],
      order: [[Warehouse, "name", "ASC"]],
    });

    const warehouses = stockRows.map((row) => ({
      warehouse_id: row.warehouse_id,
      warehouse_name: row.Warehouse?.name || "Unknown",
      location: row.Warehouse?.location || null,
      available_quantity: row.quantity,
    }));

    return resSuccess(res, {
      product_id: productId,
      product_name: product.name,
      warehouses,
    });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to fetch warehouses for product", 500);
  }
};

/**
 * POST /api/stock/out
 *
 * Body shape:
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
 *
 * Behaviour:
 * - Validates the request
 * - Checks stock per (product, warehouse)
 * - If any line is invalid / insufficient stock → whole operation fails
 * - If all good:
 *     - Decrements "stocks" table per warehouse
 *     - Inserts "stock_transactions" rows (type = 'OUT') per line
 *   All inside a single DB transaction (atomic).
 */
const createStockOut = async (req, res) => {
  const { productId, transactionDate, lines, reference_no, remarks } = req.body;

  try {
    // ---- Basic validation ----
    const parsedProductId = parseInt(productId, 10);
    if (!Number.isInteger(parsedProductId)) {
      return resError(res, "Invalid productId", 400);
    }

    if (!transactionDate) {
      return resError(res, "transactionDate is required", 400);
    }

    // Ensure transactionDate is a valid date
    const dateObj = new Date(transactionDate);
    if (Number.isNaN(dateObj.getTime())) {
      return resError(res, "Invalid transactionDate format", 400);
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return resError(res, "At least one stock-out line is required", 400);
    }

    // Clean lines (ensure positive quantities and valid warehouse IDs)
    const cleanedLines = lines
      .map((line) => ({
        warehouseId: parseInt(line.warehouseId, 10),
        quantity: Number(line.quantity),
      }))
      .filter((line) => Number.isInteger(line.warehouseId) && line.quantity > 0);

    if (cleanedLines.length === 0) {
      return resError(res, "No valid warehouse/quantity lines provided", 400);
    }

    // Optional: who is performing this action (if auth middleware sets req.user)
    const userId = req.user?.id || null;

    // ---- Wrap everything in a DB transaction for atomicity ----
    const result = await sequelize.transaction(async (t) => {
      // 1) Ensure product exists
      const product = await Product.findByPk(parsedProductId, { transaction: t });
      if (!product) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      // 2) Get all unique warehouse IDs from the lines
      const warehouseIds = [...new Set(cleanedLines.map((l) => l.warehouseId))];

      // 3) Load relevant stock rows with row-level lock to avoid race conditions
      const stockRows = await Stock.findAll({
        where: {
          product_id: parsedProductId,
          warehouse_id: { [Op.in]: warehouseIds },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const stockMap = new Map(stockRows.map((row) => [row.warehouse_id, row]));

      // 4) Validate each line against available stock
      for (const line of cleanedLines) {
        const stockRow = stockMap.get(line.warehouseId);

        if (!stockRow) {
          const err = new Error(`No stock record found for this product in warehouse ID ${line.warehouseId}`);
          err.code = "NO_STOCK_ROW";
          throw err;
        }

        const currentQty = Number(stockRow.quantity) || 0;
        if (currentQty < line.quantity) {
          const err = new Error(
            `Insufficient stock in warehouse ID ${line.warehouseId}: requested ${line.quantity}, available ${currentQty}`
          );
          err.code = "INSUFFICIENT_STOCK";
          throw err;
        }
      }

      // 5) If validation passes for all lines, apply updates
      const createdTransactions = [];

      for (const line of cleanedLines) {
        const stockRow = stockMap.get(line.warehouseId);

        // Decrement stock
        stockRow.quantity = Number(stockRow.quantity) - line.quantity;
        await stockRow.save({ transaction: t });

        // Insert stock transaction row
        const tx = await StockTransaction.create(
          {
            product_id: parsedProductId,
            warehouse_id: line.warehouseId,
            type: "OUT",
            quantity: line.quantity,
            transaction_date: transactionDate,
            source: "MANUAL",
            reference_no: reference_no || null,
            remarks: remarks || null,
            created_by: userId,
          },
          { transaction: t }
        );

        createdTransactions.push(tx);
      }

      return {
        product_id: parsedProductId,
        transaction_date: transactionDate,
        total_lines: createdTransactions.length,
        total_quantity_out: createdTransactions.reduce((sum, tx) => sum + tx.quantity, 0),
        transactions: createdTransactions.map((tx) => ({
          id: tx.id,
          warehouse_id: tx.warehouse_id,
          quantity: tx.quantity,
          type: tx.type,
        })),
      };
    });

    // If we reach here, the transaction was committed successfully
    return resSuccess(res, {
      message: "Stock out recorded successfully",
      data: result,
    });
  } catch (err) {
    console.error(err);

    // Map known error codes to nicer messages
    if (err.message === "PRODUCT_NOT_FOUND") {
      return resError(res, "Product not found", 404);
    }

    if (err.code === "NO_STOCK_ROW") {
      return resError(res, err.message, 400);
    }

    if (err.code === "INSUFFICIENT_STOCK") {
      return resError(res, err.message, 400);
    }

    return resError(res, "Failed to record stock out", 500);
  }
};

module.exports = {
  getWarehousesForProduct,
  createStockOut,
};
