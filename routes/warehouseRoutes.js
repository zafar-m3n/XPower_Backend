const express = require("express");
const router = express.Router();
const warehouseController = require("../controllers/warehouseController");

// Create warehouse
router.post("/", warehouseController.createWarehouse);

// Get all warehouses
router.get("/", warehouseController.getAllWarehouses);

// Update warehouse
router.put("/:id", warehouseController.updateWarehouse);

// Delete warehouse
router.delete("/:id", warehouseController.deleteWarehouse);

module.exports = router;
