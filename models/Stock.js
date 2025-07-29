const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Stock = sequelize.define(
  "Stock",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    warehouse_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "stocks",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["product_id", "warehouse_id"],
      },
    ],
  }
);

module.exports = Stock;
