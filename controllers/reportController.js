const { Product, Stock, Category } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");
const { Op } = require("sequelize");

// ===========================
// LOW STOCK REPORT
// ===========================
const lowStockReport = async (req, res) => {
  try {
    const threshold = 10;

    // Get all stock entries where quantity < threshold
    const lowStockEntries = await Stock.findAll({
      where: {
        quantity: { [Op.lt]: threshold },
      },
      include: [
        {
          model: Product,
          attributes: ["id", "name", "code", "brand", "cost"],
        },
      ],
    });

    // Group by product
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
// DASHBOARD STATS
// ===========================
const dashboardStats = async (req, res) => {
  try {
    const totalProducts = await Product.count();
    const totalStockResult = await Stock.findAll({
      attributes: [[require("sequelize").fn("SUM", require("sequelize").col("quantity")), "total"]],
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

module.exports = {
  lowStockReport,
  dashboardStats,
};
