const express = require("express");
const morgan = require("morgan");
const colors = require("colors");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectDB } = require("./config/database");

// ✅ Load env variables
dotenv.config();

// ✅ Connect to Database
connectDB();

// ✅ Create Express App
const app = express();

// ✅ Middleware
app.use(express.json());
app.use(morgan("dev"));

app.use(
  cors({
    origin: [process.env.NODE_XPOWER_FRONTEND_URL, "http://localhost:5173"],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  })
);

// ✅ Serve static uploads folder
app.use("/uploads", express.static("uploads"));

// ✅ Routes
const authRoutes = require("./routes/auth");
// const productRoutes = require("./routes/products");
// const reportRoutes = require("./routes/reports");

// ✅ Use Routes
app.use("/api/v1/auth", authRoutes);
// app.use("/api/v1/products", productRoutes);
// app.use("/api/v1/reports", reportRoutes);

// ✅ Root Route
app.get("/", (req, res) => {
  res.status(200).json({ message: "XPower API is running..." });
});

// ✅ Define Port
const PORT = process.env.NODE_XPOWER_PORT || 8080;

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`XPower server running on port ${PORT} in ${process.env.NODE_XPOWER_MODE} mode`.bgCyan.white);
});
