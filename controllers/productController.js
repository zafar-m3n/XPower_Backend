const { Op } = require("sequelize");
const { Product, Category, Stock, Warehouse, StockTransaction } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");
const { sequelize } = require("../config/database");

// ===========================
// Helpers
// ===========================

// Check if a row from Excel is completely empty (all cells blank/undefined/null)
const isRowCompletelyEmpty = (row) => {
  if (!row || typeof row !== "object") return true;

  const values = Object.values(row);
  if (values.length === 0) return true;

  return values.every((val) => {
    if (val === null || val === undefined) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    return false;
  });
};

// Parse GRN date from dd/mm/yyyy (or let valid Date instances pass through)
const parseGrnDateFromExcel = (value) => {
  if (value === null || value === undefined || value === "") return null;

  // Already a Date object
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Expect dd/mm/yyyy
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-based
      const year = parseInt(match[3], 10);
      const d = new Date(year, month, day);
      if (!Number.isNaN(d.getTime())) return d;
      return null;
    }

    // Fallback: try native Date parsing if format is different
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // If it gets here, we consider it invalid
  return null;
};

// ===========================
// GET ALL PRODUCTS
// ===========================

const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim();

    const whereClause = search
      ? {
          [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { code: { [Op.like]: `%${search}%` } }],
        }
      : {};

    // Fix: use count() separately without join
    const total = await Product.count({ where: whereClause });

    // Then fetch paginated product data with joins
    const rows = await Product.findAll({
      where: whereClause,
      include: [
        { model: Category, attributes: ["id", "name"] },
        { model: Stock, attributes: ["quantity"] },
      ],
      offset,
      limit,
    });

    const productsWithTotalStock = rows.map((product) => {
      const totalStock = product.Stocks.reduce((acc, stock) => acc + stock.quantity, 0);
      return {
        id: product.id,
        name: product.name,
        code: product.code,
        brand: product.brand,
        cost: product.cost,
        category: product.Category,
        total_stock: totalStock,

        // New fields exposed in list API
        grn_date: product.grn_date,
        image_url: product.image_url,
        remarks: product.remarks,
      };
    });

    return resSuccess(res, {
      products: productsWithTotalStock,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to fetch products");
  }
};

// ===========================
// GET PRODUCT DETAILS
// ===========================
const getProductDetails = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Category, attributes: ["id", "name"] },
        {
          model: Stock,
          include: [{ model: Warehouse, attributes: ["id", "name", "location"] }],
        },
      ],
    });

    if (!product) {
      return resError(res, "Product not found", 404);
    }

    const stockByWarehouse = product.Stocks.map((s) => ({
      warehouse: s.Warehouse.name,
      quantity: s.quantity,
    }));

    return resSuccess(res, {
      product: {
        id: product.id,
        name: product.name,
        code: product.code,
        brand: product.brand,
        cost: product.cost,
        description: product.description,
        category: product.Category,
        stock_by_warehouse: stockByWarehouse,

        // New fields exposed in detail API
        grn_date: product.grn_date,
        image_url: product.image_url,
        remarks: product.remarks,
      },
    });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to fetch product details");
  }
};

// ===========================
// UPLOAD PRODUCTS VIA EXCEL
// ===========================
const AUTO_CREATE_MISSING = true;

const uploadExcelProducts = async (req, res) => {
  let filePath;
  const results = {
    processed: 0,
    createdProducts: 0,
    updatedProducts: 0,
    stockCreated: 0,
    stockUpdated: 0,
    skipped: 0,
    errors: [], // per-row errors
  };

  try {
    if (!req.file) {
      return resError(res, "No Excel file uploaded", 400);
    }

    filePath = path.join(__dirname, "..", req.file.path);
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (!Array.isArray(rows) || rows.length === 0) {
      return resError(res, "Excel sheet is empty", 400);
    }

    // Optional: who is performing this action (if auth middleware sets req.user)
    const userId = req.user?.id || null;

    // Preload Category and Warehouse name->id maps (case-insensitive)
    const categories = await Category.findAll({ attributes: ["id", "name"] });
    const warehouses = await Warehouse.findAll({ attributes: ["id", "name"] });

    const categoryMap = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const warehouseMap = new Map(warehouses.map((w) => [w.name.trim().toLowerCase(), w.id]));

    // For filling down missing product names (variants)
    let lastNonEmptyName = null;

    // Use a single transaction for the whole import for atomicity
    await sequelize.transaction(async (t) => {
      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];

        // Skip completely empty rows (no counting, no errors)
        if (isRowCompletelyEmpty(row)) {
          continue;
        }

        results.processed += 1;

        // EXPECTED HEADERS IN EXCEL:
        // name, code, brand, description, cost, category_name,
        // warehouse_name, quantity,
        // grn_date (optional), image_url (optional), remarks (optional)
        let {
          name,
          code,
          brand,
          description,
          cost,
          category_name,
          warehouse_name,
          quantity,
          grn_date,
          image_url,
          remarks,
        } = row;

        // Normalise and trim basic string fields
        name = typeof name === "string" ? name.trim() : name;
        code = typeof code === "string" ? code.trim() : code;
        category_name = typeof category_name === "string" ? category_name.trim() : category_name;
        warehouse_name = typeof warehouse_name === "string" ? warehouse_name.trim() : warehouse_name;

        // === NEW: carry down last non-empty name for variants ===
        if (name && name !== "") {
          lastNonEmptyName = name;
        } else if (!name && lastNonEmptyName && code) {
          name = lastNonEmptyName;
        }

        const rowErrors = [];

        // Basic validation
        if (!name) rowErrors.push("Missing 'name'");
        if (!code) rowErrors.push("Missing 'code'");
        if (cost === undefined || cost === null || cost === "") rowErrors.push("Missing 'cost'");
        if (!category_name) rowErrors.push("Missing 'category_name'");

        // Warehouse & quantity are optional (product can be created without stock),
        // but if one is present, both should be present.
        const hasWarehouseData = warehouse_name !== undefined && warehouse_name !== null && warehouse_name !== "";
        const hasQuantityData = quantity !== undefined && quantity !== null && quantity !== "";

        if ((hasWarehouseData && !hasQuantityData) || (!hasWarehouseData && hasQuantityData)) {
          rowErrors.push("Provide both 'warehouse_name' and 'quantity' or neither");
        }

        // Optional: validate GRN date format if provided (dd/mm/yyyy)
        let parsedGrnDate = null;
        if (grn_date !== undefined && grn_date !== null && grn_date !== "") {
          parsedGrnDate = parseGrnDateFromExcel(grn_date);
          if (!parsedGrnDate) {
            rowErrors.push("Invalid 'grn_date' format (expected dd/mm/yyyy)");
          }
        }

        if (rowErrors.length) {
          results.skipped += 1;
          results.errors.push({
            row: idx + 2, // +2 for header + 1-based row
            code,
            errors: rowErrors,
          });
          continue;
        }

        // Resolve Category ID by name (case-insensitive)
        const catKey = String(category_name).trim().toLowerCase();
        let category_id = categoryMap.get(catKey);

        if (!category_id && AUTO_CREATE_MISSING) {
          const newCat = await Category.create({ name: String(category_name).trim() }, { transaction: t });
          category_id = newCat.id;
          categoryMap.set(catKey, newCat.id);
        }

        if (!category_id) {
          results.skipped += 1;
          results.errors.push({
            row: idx + 2,
            code,
            errors: [`Category '${category_name}' not found`],
          });
          continue;
        }

        // Parse numeric fields
        const parsedCost = Number(cost);
        if (Number.isNaN(parsedCost)) {
          results.skipped += 1;
          results.errors.push({
            row: idx + 2,
            code,
            errors: ["'cost' is not a number"],
          });
          continue;
        }

        // Find or create product by unique 'code'
        let product = await Product.findOne({
          where: { code },
          transaction: t,
        });

        if (!product) {
          // Create new product with new fields
          product = await Product.create(
            {
              name,
              code,
              brand: brand ?? null,
              description: description ?? null,
              cost: parsedCost,
              category_id,
              grn_date: parsedGrnDate,
              image_url: image_url ?? null,
              remarks: remarks ?? null,
            },
            { transaction: t }
          );
          results.createdProducts += 1;
        } else {
          // Update existing product (including new fields if provided)
          product.name = name ?? product.name;
          product.brand = brand ?? product.brand;
          product.description = description ?? product.description;
          product.cost = parsedCost ?? product.cost;
          product.category_id = category_id;

          if (parsedGrnDate) {
            product.grn_date = parsedGrnDate;
          }
          if (image_url !== undefined) {
            product.image_url = image_url ?? product.image_url;
          }
          if (remarks !== undefined) {
            product.remarks = remarks ?? product.remarks;
          }

          await product.save({ transaction: t });
          results.updatedProducts += 1;
        }

        // If stock columns present, resolve warehouse and upsert stock
        if (hasWarehouseData && hasQuantityData) {
          const whKey = String(warehouse_name).trim().toLowerCase();
          let warehouse_id = warehouseMap.get(whKey);

          if (!warehouse_id && AUTO_CREATE_MISSING) {
            const newWh = await Warehouse.create({ name: String(warehouse_name).trim() }, { transaction: t });
            warehouse_id = newWh.id;
            warehouseMap.set(whKey, newWh.id);
          }

          if (!warehouse_id) {
            results.errors.push({
              row: idx + 2,
              code,
              errors: [`Warehouse '${warehouse_name}' not found`],
            });
            // Don’t skip the product creation—just skip stock creation
            continue;
          }

          const qty = Number(quantity);
          if (!Number.isFinite(qty)) {
            results.errors.push({
              row: idx + 2,
              code,
              errors: ["'quantity' is not a valid number"],
            });
            continue;
          }

          const existingStock = await Stock.findOne({
            where: { product_id: product.id, warehouse_id },
            transaction: t,
            lock: t.LOCK.UPDATE, // defensive for concurrent imports
          });

          if (!existingStock) {
            await Stock.create({ product_id: product.id, warehouse_id, quantity: qty }, { transaction: t });
            results.stockCreated += 1;
          } else {
            // increment quantity (or replace if you prefer)
            existingStock.quantity = Number(existingStock.quantity) + qty;
            await existingStock.save({ transaction: t });
            results.stockUpdated += 1;
          }

          // Record stock IN transaction for this row
          await StockTransaction.create(
            {
              product_id: product.id,
              warehouse_id,
              type: "IN",
              quantity: qty,
              transaction_date: parsedGrnDate || new Date(),
              source: "EXCEL",
              reference_no: null, // could be extended later
              remarks: remarks ?? null,
              created_by: userId,
            },
            { transaction: t }
          );
        }
      }
    });

    // Clean up file
    fs.unlinkSync(filePath);

    return resSuccess(res, {
      message: "Excel upload complete",
      summary: results,
    });
  } catch (err) {
    console.error(err);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
    return resError(res, "Failed to upload Excel");
  }
};

module.exports = {
  getAllProducts,
  getProductDetails,
  uploadExcelProducts,
};
