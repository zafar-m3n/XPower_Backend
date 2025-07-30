const express = require("express");
const router = express.Router();

const {
  getAllProducts,
  getProductDetails,
  searchProducts,
  addProductForm,
  uploadExcelProducts,
} = require("../controllers/productController");

const authenticate = require("../middlewares/authMiddleware");
const { getMulterUpload } = require("../config/multerConfig");

// Multer upload instance for Excel files
const upload = getMulterUpload("uploads/products");

// @route   GET /api/v1/products
// @desc    Get all products
router.get("/", authenticate, getAllProducts);

// @route   GET /api/v1/products/:id
// @desc    Get product details by ID
router.get("/:id", authenticate, getProductDetails);

// @route   POST /api/v1/products/upload
// @desc    Upload products via Excel
router.post("/upload", authenticate, upload.single("file"), uploadExcelProducts);

module.exports = router;
