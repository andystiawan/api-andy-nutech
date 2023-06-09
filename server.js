require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const multer = require("multer");
const app = express();
const path = require("path");
const secretKey = "rahasia123"; // Kunci rahasia untuk JWT

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Membuat koneksi ke MongoDB
mongoose.connect(`${process.env.MONGODB_URI}/${process.env.MONGODB_DB}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", () => {
  console.log("Connected to the database");
});

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads");
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueSuffix + "-" + file.originalname);
//   },
// });

// const upload = multer({ storage: storage });

var storage = multer.memoryStorage();
var upload = multer({ storage: storage });

// Membuat skema dan model barang
const productSchema = new mongoose.Schema({
  photo: String,
  name: String,
  purchasePrice: Number,
  sellingPrice: Number,
  stock: Number,
});
const Product = mongoose.model("Product", productSchema);

// Model User
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const User = mongoose.model("User", userSchema);

//Image model
// const ImageSchema = new mongoose.Schema({
//   name: { type: String, required: true, max: 100 },
//   img: { data: Buffer, contentType: String },
// });

// const Image = mongoose.model("Image", ImageSchema);

// Middleware untuk verifikasi token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .send({ status: 401, message: "Token JWT tidak ditemukan." });
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res
        .status(403)
        .send({ status: 403, message: "Token JWT tidak valid." });
    }

    // Tambahkan objek user ke req untuk digunakan pada handler endpoint berikutnya (opsional)
    req.user = user;

    next();
  });
};

//Get User
app.get("/user", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found !" });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res
      .status(500)
      .json({ status: 500, message: "Internal server error" });
  }
});

// Endpoint: Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;

  // TODO: Validasi input

  bcrypt
    .hash(password, 10)
    .then((hashedPassword) => {
      const user = new User({ username, password: hashedPassword });

      user
        .save()
        .then((result) => {
          const token = jwt.sign({ id: user._id }, secretKey, {
            expiresIn: 86400,
          });

          return res
            .status(200)
            .send({ status: 200, auth: true, token: token });
        })
        .catch((err) => {
          return res.status(500).send({
            status: 500,
            message: "Registrasi tidak berhasil",
          });
        });
    })
    .catch((err) => {
      return res.status(500).send({
        status: 500,
        message: "Registrasi tidak berhasil",
      });
    });
});

// Endpoint: Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // TODO: Validasi input

  User.findOne({ username })
    .then((user) => {
      if (!user) {
        return res.status(401).send({
          status: 401,
          message: "Autentikasi gagal. Periksa username dan kata sandi Anda.",
        });
      }

      bcrypt
        .compare(password, user.password)
        .then((result) => {
          if (!result) {
            return res.status(401).send({
              status: 401,
              message:
                "Autentikasi gagal. Periksa username dan kata sandi Anda.",
            });
          }

          const token = jwt.sign({ id: user._id }, secretKey, {
            expiresIn: 86400,
          });

          return res
            .status(200)
            .send({ status: 200, auth: true, token: token });
        })
        .catch((err) => {
          return res.status(500).send({
            status: 500,
            message: "Terjadi kesalahan saat membandingkan kata sandi.",
          });
        });
    })
    .catch((err) => {
      return res.status(500).send({
        status: 500,
        message: "Terjadi kesalahan saat mencari pengguna.",
      });
    });
});

// Endpoint: Get Foto Barang
app.get("/products/photo/:filename", (req, res) => {
  const filename = req.params.filename;

  // Menggabungkan filename dengan path ke direktori foto
  const fotoPath = path.join(__dirname, "uploads", filename);

  // Mengirimkan foto sebagai respons
  res.sendFile(fotoPath);
});

// Endpoint untuk membuat data barang baru
app.post(
  "/products",
  authenticateToken,
  upload.single("photo"),
  async (req, res) => {
    const { name, purchasePrice, sellingPrice, stock } = req.body;
    try {
      // Simpan data barang baru ke database
      const product = new Product({
        photo: req.file.buffer.toString("base64"),
        name,
        purchasePrice,
        sellingPrice,
        stock,
      });

      await product
        .save()
        .then((result) => {
          return res.status(200).send({
            data: result,
            status: 200,
            message: "Data barang berhasil ditambahkan",
          });
        })
        .catch((err) => {
          return res
            .status(500)
            .send({ status: 500, message: "Gagal menyimpan barang." });
        });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 500, message: "Gagal menyimpan barang." });
    }
  }
);

// Endpoint untuk mendapatkan data barang
app.get("/products", authenticateToken, async (req, res) => {
  try {
    // Ambil semua data barang dari database
    const products = await Product.find();
    res.json({ data: products, status: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
});

// Endpoint untuk mendapatkan data barang berdasarkan ID
app.get("/products/:id", authenticateToken, async (req, res) => {
  const productId = req.params.id;

  try {
    // Cari data barang berdasarkan ID
    const product = await Product.findById(productId);

    // Jika data barang tidak ditemukan
    if (!product) {
      return res
        .status(404)
        .json({ status: 404, message: "Data barang tidak ditemukan" });
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Endpoint untuk mengupdate data barang
app.put(
  "/products/:id",
  authenticateToken,
  upload.single("photo"),
  async (req, res) => {
    const productId = req.params.id;
    const { name, purchasePrice, sellingPrice, stock } = req.body;
    try {
      // Cari data barang berdasarkan ID
      const product = await Product.findById(productId);

      // Jika data barang tidak ditemukan
      if (!product) {
        return res.status(404).json({ message: "Data barang tidak ditemukan" });
      }

      // Update data barang
      product.photo = req.file.buffer.toString("base64");
      product.name = name;
      product.purchasePrice = purchasePrice;
      product.sellingPrice = sellingPrice;
      product.stock = stock;
      await product.save();

      res.json({ status: 200, message: "Data barang berhasil diubah" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Data barang gagal diubah" });
    }
  }
);

// Endpoint untuk menghapus data barang
app.delete("/products/:id", authenticateToken, async (req, res) => {
  const productId = req.params.id;

  try {
    // Hapus data barang berdasarkan ID
    await Product.findByIdAndDelete(productId);

    res.json({ message: "Data barang berhasil dihapus" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3030;

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
