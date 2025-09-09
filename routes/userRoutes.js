const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const { listUsers, getUserById, createUser, updateUser, deleteUser } = require("../controllers/userController");

/**
 * @route   GET /api/v1/users
 * @desc    List users (paginated & searchable)
 * @query   page=1&limit=10&q=searchTerm
 * @access  Private (JWT)
 */
router.get("/", authenticate, listUsers);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get a single user by id
 * @access  Private (JWT)
 */
router.get("/:id", authenticate, getUserById);

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user
 * @body    { full_name, email, password }
 * @access  Private (JWT)
 */
router.post("/", authenticate, createUser);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update an existing user
 * @body    { full_name?, email?, password? }
 * @access  Private (JWT)
 */
router.put("/:id", authenticate, updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete a user
 * @access  Private (JWT)
 */
router.delete("/:id", authenticate, deleteUser);

module.exports = router;
