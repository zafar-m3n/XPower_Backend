const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Product = sequelize.define(
  "Product",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    brand: { type: DataTypes.STRING(100), allowNull: true },
    cost: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    category_id: { type: DataTypes.INTEGER, allowNull: true },
    grn_date: { type: DataTypes.DATE, allowNull: true },
    image_url: { type: DataTypes.STRING(255), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "products",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Product;
