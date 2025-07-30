const { Op } = require("sequelize");
const { Product, Category, Stock, Warehouse } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

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

    const { count, rows } = await Product.findAndCountAll({
      where: whereClause,
      include: [
        { model: Category, attributes: ["id", "name"] },
        {
          model: Stock,
          attributes: ["quantity"],
        },
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
      };
    });

    return resSuccess(res, {
      products: productsWithTotalStock,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
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
const uploadExcelProducts = async (req, res) => {
  try {
    if (!req.file) {
      return resError(res, "No Excel file uploaded", 400);
    }

    const filePath = path.join(__dirname, "..", req.file.path);
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    for (const row of rows) {
      const { name, code, brand, description, cost, category_id, warehouse_id, quantity } = row;

      // Step 1: Create/find the product
      let product = await Product.findOne({ where: { code } });

      if (!product) {
        product = await Product.create({
          name,
          code,
          brand,
          description,
          cost,
          category_id,
        });
      }

      // Step 2: If warehouse_id & quantity are given, create stock row
      if (warehouse_id && quantity !== undefined) {
        const existingStock = await Stock.findOne({
          where: {
            product_id: product.id,
            warehouse_id: warehouse_id,
          },
        });

        if (!existingStock) {
          await Stock.create({
            product_id: product.id,
            warehouse_id,
            quantity,
          });
        } else {
          // Optional: update quantity if needed
          existingStock.quantity += Number(quantity);
          await existingStock.save();
        }
      }
    }

    fs.unlinkSync(filePath);
    return resSuccess(res, { message: "Excel upload complete" });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to upload Excel");
  }
};

module.exports = {
  getAllProducts,
  getProductDetails,
  uploadExcelProducts,
};
