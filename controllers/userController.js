const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { User } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");

// ------------------------------
// GET /users
// Query params: page=1&limit=10&q=searchTerm
// ------------------------------
const listUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const q = (req.query.q || "").trim();

    const where = q
      ? {
          [Op.or]: [{ full_name: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }],
        }
      : {};

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password"] },
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    return resSuccess(res, {
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to fetch users", 500);
  }
};

// ------------------------------
// GET /users/:id
// ------------------------------
const getUserById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return resError(res, "Invalid user id", 400);

    const user = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) return resError(res, "User not found", 404);

    return resSuccess(res, { data: user });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to fetch user", 500);
  }
};

// ------------------------------
// POST /users
// Body: { full_name, email, password }
// ------------------------------
const createUser = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return resError(res, "full_name, email and password are required", 400);
    }

    // unique email check
    const exists = await User.findOne({ where: { email } });
    if (exists) return resError(res, "Email already registered", 400);

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await User.create({
      full_name,
      email,
      password: password_hash,
    });

    return resSuccess(
      res,
      {
        message: "User created",
        data: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      },
      201
    );
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to create user", 500);
  }
};

// ------------------------------
// PUT /users/:id
// Body: { full_name?, email?, password? }
// ------------------------------
const updateUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return resError(res, "Invalid user id", 400);

    const user = await User.findByPk(id);
    if (!user) return resError(res, "User not found", 404);

    const { full_name, email, password } = req.body;

    // If email being changed, ensure uniqueness (excluding current user)
    if (email && email !== user.email) {
      const emailTaken = await User.findOne({ where: { email } });
      if (emailTaken) return resError(res, "Email already in use", 400);
      user.email = email;
    }

    if (full_name) user.full_name = full_name;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    return resSuccess(res, {
      message: "User updated",
      data: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to update user", 500);
  }
};

// ------------------------------
// DELETE /users/:id
// ------------------------------
const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return resError(res, "Invalid user id", 400);

    const user = await User.findByPk(id);
    if (!user) return resError(res, "User not found", 404);

    await user.destroy();

    return resSuccess(res, { message: "User deleted" });
  } catch (err) {
    console.error(err);
    return resError(res, "Failed to delete user", 500);
  }
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};