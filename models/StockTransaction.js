// models/StockTransaction.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const StockTransaction = sequelize.define(
  "StockTransaction",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // Foreign keys
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // IN = stock increases, OUT = stock decreases
    type: {
      type: DataTypes.ENUM("IN", "OUT"),
      allowNull: false,
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // Effective date of the movement (GRN date / sale date)
    transaction_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // Metadata
    source: {
      type: DataTypes.ENUM("EXCEL", "MANUAL"),
      allowNull: false,
      defaultValue: "MANUAL",
    },

    reference_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Who created this record (links to users.id)
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "stock_transactions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        // For reporting per product/warehouse over time
        fields: ["product_id", "warehouse_id", "transaction_date"],
      },
      {
        fields: ["type"],
      },
      {
        fields: ["source"],
      },
    ],
  }
);

module.exports = StockTransaction;
