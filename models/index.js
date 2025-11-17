const User = require("./User");
const Category = require("./Category");
const Warehouse = require("./Warehouse");
const Product = require("./Product");
const Stock = require("./Stock");
const StockTransaction = require("./StockTransaction");

// === Associations ===

// Product → Category
Category.hasMany(Product, {
  foreignKey: "category_id",
  onDelete: "SET NULL",
});
Product.belongsTo(Category, {
  foreignKey: "category_id",
});

// Product → Stock
Product.hasMany(Stock, {
  foreignKey: "product_id",
  onDelete: "CASCADE",
});
Stock.belongsTo(Product, {
  foreignKey: "product_id",
});

// Warehouse → Stock
Warehouse.hasMany(Stock, {
  foreignKey: "warehouse_id",
  onDelete: "CASCADE",
});
Stock.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
});

// Product → StockTransaction
Product.hasMany(StockTransaction, {
  foreignKey: "product_id",
  onDelete: "CASCADE",
});
StockTransaction.belongsTo(Product, {
  foreignKey: "product_id",
});

// Warehouse → StockTransaction
Warehouse.hasMany(StockTransaction, {
  foreignKey: "warehouse_id",
  onDelete: "CASCADE",
});
StockTransaction.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
});

// User → StockTransaction (who created the transaction)
User.hasMany(StockTransaction, {
  foreignKey: "created_by",
  onDelete: "SET NULL",
});
StockTransaction.belongsTo(User, {
  foreignKey: "created_by",
});

// === Export all models ===
module.exports = {
  User,
  Category,
  Warehouse,
  Product,
  Stock,
  StockTransaction,
};
