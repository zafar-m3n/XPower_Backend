const { Product, Stock, Category, Warehouse } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");
const { Op, fn, col, literal } = require("sequelize");

const path = require("path");
const ejs = require("ejs");
const puppeteer = require("puppeteer");

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
      include: [
        {
          model: Product,
          attributes: ["id", "name", "code", "brand", "cost", "grn_date", "image_url", "remarks"],
        },
      ],
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

      // New fields in low stock report
      grn_date: entry.product.grn_date,
      image_url: entry.product.image_url,
      remarks: entry.product.remarks,
    }));

    return resSuccess(res, { low_stock: lowStockProducts });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to generate low stock report");
  }
};

// ===========================
// STOCK BY WAREHOUSE REPORT
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

              // New fields in out of stock report
              grn_date: product.grn_date,
              image_url: product.image_url,
              remarks: product.remarks,
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

// ===========================
// PDF GENERATION (Puppeteer)
// ===========================
const generateReportPDF = async (req, res) => {
  const { type } = req.params;

  const config = {
    "low-stock": {
      title: "Low Stock Report",
      fetcher: lowStockReport,
      key: "low_stock",
      columns: [
        { key: "name", label: "Product Name" },
        { key: "code", label: "Code" },
        { key: "brand", label: "Brand" },
        { key: "cost", label: "Cost" },
        { key: "total_quantity", label: "Qty" },
        { key: "grn_date", label: "GRN Date" },
        { key: "remarks", label: "Remarks" },
      ],
    },
    "out-of-stock": {
      title: "Out of Stock Report",
      fetcher: outOfStockReport,
      key: "out_of_stock",
      columns: [
        { key: "name", label: "Product Name" },
        { key: "code", label: "Code" },
        { key: "brand", label: "Brand" },
        { key: "cost", label: "Cost" },
        { key: "grn_date", label: "GRN Date" },
        { key: "remarks", label: "Remarks" },
      ],
    },
    "stock-by-warehouse": {
      title: "Stock by Warehouse",
      fetcher: stockByWarehouseReport,
      key: "stock_by_warehouse",
      columns: [
        { key: "warehouse_name", label: "Warehouse" },
        { key: "location", label: "Location" },
        { key: "total_quantity", label: "Total Qty" },
      ],
    },
  };

  const report = config[type];
  if (!report) return res.status(400).json({ error: "Invalid report type." });

  try {
    const mockReq = { ...req };
    const mockRes = {
      status: () => mockRes,
      json: (data) => data,
    };
    const rawResult = await report.fetcher(mockReq, mockRes);
    const rows = rawResult?.data?.[report.key] || [];

    const html = await ejs.renderFile(path.join(__dirname, "..", "views", "report-pdf.ejs"), {
      title: report.title,
      columns: report.columns,
      rows,
    });

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "30px", bottom: "30px", left: "30px", right: "30px" },
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.title}.pdf"`,
    });

    res.send(buffer);
  } catch (err) {
    console.error("PDF generation failed:", err);
    res.status(500).json({ error: "Failed to generate PDF." });
  }
};

module.exports = {
  dashboardStats,
  lowStockReport,
  stockByWarehouseReport,
  outOfStockReport,
  generateReportPDF,
};
