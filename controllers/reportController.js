const { Product, Stock, Category, Warehouse } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");
const { Op, fn, col, literal } = require("sequelize");

// ===========================
// DASHBOARD STATS
// ===========================
const dashboardStats = async (req, res) => {
  try {
    const totalProducts = await Product.count();
    const totalStockResult = await Stock.findAll({
      attributes: [[fn("SUM", col("quantity")), "total"]],
      raw: true,
    });
    const totalStock = parseInt(totalStockResult[0].total || 0);

    const lowStockCountResult = await Stock.findAll({
      where: { quantity: { [Op.lt]: 10 } },
      attributes: ["product_id"],
      group: ["product_id"],
    });

    const lowStockCount = lowStockCountResult.length;
    const categoryCount = await Category.count();

    return resSuccess(res, {
      total_products: totalProducts,
      total_stock: totalStock,
      low_stock_count: lowStockCount,
      category_count: categoryCount,
    });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to fetch dashboard stats");
  }
};

// ===========================
// LOW STOCK REPORT
// ===========================
const lowStockReport = async (req, res) => {
  try {
    const threshold = 10;
    const lowStockEntries = await Stock.findAll({
      where: { quantity: { [Op.lt]: threshold } },
      include: [{ model: Product, attributes: ["id", "name", "code", "brand", "cost"] }],
    });

    const grouped = {};

    for (const stock of lowStockEntries) {
      const key = stock.product_id;
      if (!grouped[key]) {
        grouped[key] = {
          product: stock.Product,
          total_quantity: 0,
        };
      }
      grouped[key].total_quantity += stock.quantity;
    }

    const lowStockProducts = Object.values(grouped).map((entry) => ({
      id: entry.product.id,
      name: entry.product.name,
      code: entry.product.code,
      brand: entry.product.brand,
      cost: entry.product.cost,
      total_quantity: entry.total_quantity,
    }));

    return resSuccess(res, { low_stock: lowStockProducts });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to generate low stock report");
  }
};

// ===========================
// STOCK BY WAREHOUSE
// ===========================
const stockByWarehouseReport = async (req, res) => {
  try {
    const results = await Stock.findAll({
      attributes: ["warehouse_id", [fn("SUM", col("quantity")), "total_quantity"]],
      include: [
        {
          model: Warehouse,
          attributes: ["id", "name", "location"],
        },
      ],
      group: ["warehouse_id", "Warehouse.id"],
    });

    const summary = results.map((entry) => ({
      warehouse_id: entry.warehouse_id,
      warehouse_name: entry.Warehouse.name,
      location: entry.Warehouse.location,
      total_quantity: parseInt(entry.get("total_quantity")),
    }));

    return resSuccess(res, { stock_by_warehouse: summary });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to generate stock by warehouse report");
  }
};

// ===========================
// STOCK BY CATEGORY
// ===========================
const stockByCategoryReport = async (req, res) => {
  try {
    const results = await Stock.findAll({
      attributes: [
        [fn("SUM", col("quantity")), "total_quantity"],
        [fn("SUM", literal("quantity * Product.cost")), "total_value"],
      ],
      include: [
        {
          model: Product,
          attributes: ["id", "name", "cost", "category_id"],
          include: [{ model: Category, attributes: ["id", "name"] }],
        },
      ],
    });

    const grouped = {};

    for (const entry of results) {
      const cat = entry.Product.Category;
      if (!cat) continue;

      if (!grouped[cat.id]) {
        grouped[cat.id] = {
          category_id: cat.id,
          category_name: cat.name,
          total_quantity: 0,
          total_value: 0,
        };
      }

      grouped[cat.id].total_quantity += entry.quantity;
      grouped[cat.id].total_value += parseFloat(entry.quantity * entry.Product.cost);
    }

    const summary = Object.values(grouped);

    return resSuccess(res, { stock_by_category: summary });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to generate stock by category report");
  }
};

// ===========================
// OUT OF STOCK REPORT
// ===========================
const outOfStockReport = async (req, res) => {
  try {
    const results = await Product.findAll({
      include: [{ model: Stock, attributes: ["quantity"] }],
    });

    const outOfStock = results
      .map((product) => {
        const total = product.Stocks.reduce((sum, s) => sum + s.quantity, 0);
        return total === 0
          ? {
              id: product.id,
              name: product.name,
              code: product.code,
              brand: product.brand,
              cost: product.cost,
            }
          : null;
      })
      .filter((p) => p !== null);

    return resSuccess(res, { out_of_stock: outOfStock });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to generate out of stock report");
  }
};

module.exports = {
  dashboardStats,
  lowStockReport,
  stockByWarehouseReport,
  stockByCategoryReport,
  outOfStockReport,
};
