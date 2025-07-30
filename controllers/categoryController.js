const { Category } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");

// Create a new category
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return resError(res, "Name is required", 400);

    const category = await Category.create({ name });
    return resSuccess(res, { message: "Category created", category });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to create category");
  }
};

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [["created_at", "DESC"]] });
    return resSuccess(res, { categories });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to fetch categories");
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const category = await Category.findByPk(id);
    if (!category) return resError(res, "Category not found", 404);

    category.name = name || category.name;
    await category.save();

    return resSuccess(res, { message: "Category updated", category });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to update category");
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);
    if (!category) return resError(res, "Category not found", 404);

    await category.destroy();
    return resSuccess(res, { message: "Category deleted" });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to delete category");
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};
