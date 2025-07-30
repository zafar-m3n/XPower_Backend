const { Warehouse } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");

// Create warehouse
const createWarehouse = async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name) return resError(res, "Name is required", 400);

    const warehouse = await Warehouse.create({ name, location });
    return resSuccess(res, { message: "Warehouse created", warehouse });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to create warehouse");
  }
};

// Get all warehouses
const getAllWarehouses = async (req, res) => {
  try {
    const warehouses = await Warehouse.findAll({ order: [["created_at", "DESC"]] });
    return resSuccess(res, { warehouses });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to fetch warehouses");
  }
};

// Update warehouse
const updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location } = req.body;

    const warehouse = await Warehouse.findByPk(id);
    if (!warehouse) return resError(res, "Warehouse not found", 404);

    warehouse.name = name || warehouse.name;
    warehouse.location = location || warehouse.location;
    await warehouse.save();

    return resSuccess(res, { message: "Warehouse updated", warehouse });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to update warehouse");
  }
};

// Delete warehouse
const deleteWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const warehouse = await Warehouse.findByPk(id);
    if (!warehouse) return resError(res, "Warehouse not found", 404);

    await warehouse.destroy();
    return resSuccess(res, { message: "Warehouse deleted" });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to delete warehouse");
  }
};

module.exports = {
  createWarehouse,
  getAllWarehouses,
  updateWarehouse,
  deleteWarehouse,
};
