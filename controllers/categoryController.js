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

// Get all categories (paginated)
const getAllCategories = async (req, res) => {
  try {
    // 1) Read & sanitize query params
    const rawPage = Number(req.query.page) || 1;
    const rawLimit = Number(req.query.limit) || 10;

    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const MAX_LIMIT = 100;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : 10;

    const offset = (page - 1) * limit;

    // 2) Fetch rows + total count
    const { rows, count } = await Category.findAndCountAll({
      limit,
      offset,
    });

    // 3) Compute meta
    const total = count;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // 4) Respond
    return resSuccess(res, {
      categories: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    });
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
