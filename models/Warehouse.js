const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Warehouse = sequelize.define(
  "Warehouse",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    location: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: "warehouses",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Warehouse;
