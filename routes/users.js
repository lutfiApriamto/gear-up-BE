// ./routes/users.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { User } from '../models/User.js';
import { Voucher } from '../models/Voucher.js';
import { generateUniqueVoucherCode } from "../utils/generateVoucherCode.js";
import { verifyUser, verifyAdmin } from '../middlewares/auth.js';
import { Product } from '../models/Product.js';
import mongoose from "mongoose";
import { parsePagination } from '../middlewares/parsePagination.js';
dotenv.config();
const router = express.Router();

// ==========================
// AUTH USER RUTE
// ==========================

// =====  1. Registrasi =====
router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    // 🔍 Validasi email atau no hp sudah terdaftar
    const validateEmail = await User.findOne({ email });
    const validatePhone = await User.findOne({ phone });

    if (validateEmail) {
      return res.status(400).json({ message: "Email sudah terdaftar", status: false });
    }

    if (validatePhone) {
      return res.status(400).json({ message: "Nomor handphone sudah terdaftar", status: false });
    }

    //  Enkripsi password
    const hashedPassword = await bcrypt.hash(password, 10);

    //  Buat user baru
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      status: "aktif",
      role: "user"
    });

    await newUser.save();

    //  Buat voucher khusus pengguna baru
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // berlaku 30 hari dari tanggal registrasi

    const voucherTitle = `Welcome Voucher - ${name}`;
    const voucherCode = await generateUniqueVoucherCode(name);

    const newVoucher = new Voucher({
      title: voucherTitle,
      code: voucherCode,
      description: "Selamat datang di GEARUP! Nikmati potongan harga 15% untuk pembelian pertamamu.",
      discountType: "percentage",
      discountValue: 15,
      minPurchase: 100000,
      expiryDate,
      maxDiscountValue: 50000,
      claimedCount : 1,
      maxUse: 1,
      type: "newUser",
      isActive: true
    });

    await newVoucher.save();

    //  Tambahkan voucher ke data user
    newUser.vouchers.push({
      voucher: newVoucher._id,
      isUsed: false,
      claimedAt: new Date()
    });

    // Tambahkan dua notifikasi
    newUser.userNotification.push(
      {
        notificationTitle: "Registrasi Berhasil 🎉",
        statusNotification: "belum-dibaca",
        description: `Selamat ${name}! Akun GEARUP kamu telah berhasil dibuat. Sekarang kamu bisa mulai menjelajahi produk-produk terbaik kami.`,
      },
      {
        notificationTitle: "Voucher Pengguna Baru 🎁",
        statusNotification: "belum-dibaca",
        description: `Sebagai ucapan selamat datang, kamu mendapatkan voucher khusus pengguna baru dengan kode ${voucherCode}. Gunakan sebelum ${expiryDate.toLocaleDateString()} untuk potongan 15% di pembelian pertamamu.`,
      }
    );

    await newUser.save();

    //  Kirim email selamat datang menggunakan NodeMailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"GEARUP" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Selamat Datang di GEARUP 🎉",
      html: `
      <div style="font-family: Arial, sans-serif; background-color: #EDFAF2; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #FFFFFF; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border: 1px solid #DEDEDE;">

          <!-- Header -->
          <div style="background-color: #00BA47; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0;">GEARUP</h1>
            <p style="margin: 0;">STEP IN. GEAR UP.</p>
          </div>

          <!-- Body -->
          <div style="padding: 30px; color: #333;">
            <h2 style="color: #00BA47;">Halo ${name}, Selamat Datang di GEARUP!</h2>
            <p style="font-size: 15px; line-height: 1.6;">
              Terima kasih telah mendaftar di GEARUP. Akun kamu telah berhasil dibuat dan siap digunakan.  
              Sebagai ucapan selamat datang, kami memberikan <strong>voucher khusus pengguna baru</strong> untuk kamu.
            </p>

            <div style="margin: 25px 0; text-align: center;">
              <div style="background-color: #F6FFF9; border: 2px dashed #00BA47; padding: 15px; border-radius: 8px; display: inline-block;">
                <p style="margin: 0; color: #333; font-size: 16px;">Gunakan kode voucher berikut:</p>
                <h2 style="margin: 8px 0; color: #00BA47;">${voucherCode}</h2>
                <p style="margin: 0; font-size: 14px; color: #666;">Berlaku hingga ${expiryDate.toLocaleDateString()}</p>
              </div>
            </div>

            <p style="font-size: 14px; color: #444;">
              Segera gunakan voucher ini untuk mendapatkan <strong>diskon 15%</strong> di pembelian pertamamu.
              Kami sangat senang menyambut kamu menjadi bagian dari komunitas GEARUP.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href=${process.env.CLIENT_URL} style="background-color: #00BA47; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
                Mulai Belanja Sekarang
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #F5F5F5; padding: 15px; text-align: center; font-size: 12px; color: #777;">
            © ${new Date().getFullYear()} GEARUP. All rights reserved.
          </div>

        </div>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    //  Kirim respon sukses
    return res.status(200).json({
      status: true,
      message: "Registrasi berhasil! Voucher dan email selamat datang telah dikirim.",
      user: newUser,
    });

  } catch (error) {
    console.error("❌ Error saat registrasi:", error);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan registrasi",
      error: error.message,
    });
  }
});

// ===== 2. Login =====
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Akun Tidak Ditemukan" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ message: "Akun Anda Dibekukan" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Email atau Password salah" });
    }

    const token = jwt.sign(
      { name: user.name, role: user.role, _id : user._id },
      process.env.KEY,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      message: "Login berhasil",
      token,
      role: user.role,
      name: user.name,
      status : user.status
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal Melakukan Login Pengguna",
      error: error.message
    });
  }
});

// ===== 3. Lupa Password =====
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // 1️⃣ Cek apakah email pengguna terdaftar
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ status: false, message: "Akun tidak ditemukan." });
    }

    // 2️⃣ Buat token JWT (berlaku 10 menit)
    const token = jwt.sign({ id: user._id }, process.env.KEY, { expiresIn: "10m" });

    // 3️⃣ Buat transporter untuk mengirim email (pakai akun Gmail dari env)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 4️⃣ Siapkan tampilan HTML email bertema GEARUP
    const mailOptions = {
      from: `"GEARUP Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Password - GEARUP",
      html: `
      <div style="font-family: Arial, sans-serif; background-color: #EDFAF2; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #FFFFFF; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border: 1px solid #DEDEDE;">
          
          <!-- Header -->
          <div style="background-color: #00BA47; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0;">GEARUP</h1>
            <p style="margin: 0;">STEP IN. GEAR UP.</p>
          </div>

          <!-- Body -->
          <div style="padding: 30px; color: #333; text-align: center;">
            <h2 style="color: #00BA47;">Permintaan Reset Password</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #444;">
              Halo <strong>${user.name}</strong>, kami menerima permintaan untuk mereset password akun kamu.  
              Klik tombol di bawah ini untuk melanjutkan proses reset password.
            </p>

            <div style="margin: 25px 0;">
              <a href="${process.env.CLIENT_URL}/reset-password/user/${token}"
                style="display: inline-block; background-color: #00BA47; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
                Reset Password
              </a>
            </div>

            <p style="font-size: 14px; color: #666; line-height: 1.5;">
              Link ini hanya berlaku selama <strong>10 menit</strong>.  
              Jika kamu tidak merasa meminta reset password, abaikan email ini dan password kamu tetap aman.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #F5F5F5; padding: 15px; text-align: center; font-size: 12px; color: #777;">
            © ${new Date().getFullYear()} GEARUP. All rights reserved.
          </div>

        </div>
      </div>
      `,
    };

    // 5️⃣ Kirim email menggunakan transporter
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ status: false, message: "Gagal mengirim email reset password." });
      } else {
        return res.status(200).json({
          status: true,
          message: "Email reset password telah dikirim. Silakan periksa inbox atau folder spam Anda.",
        });
      }
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      status: false,
      message: "Terjadi kesalahan saat memproses permintaan.",
      error: error.message,
    });
  }
});

// ===== 4. Reset Password =====
router.post('/reset-password', async (req, res) => {
  const { password, token } = req.body;

  try {
    // 1️⃣ Pastikan token dikirim
    if (!token) {
      return res.status(400).json({ status: false, message: "Token tidak ditemukan" });
    }

    // 2️⃣ Verifikasi token menggunakan jwt.verify
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.KEY);
    } catch (err) {
      // Jika token sudah kedaluwarsa
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          status: false,
          message: "Token sudah kedaluwarsa, silakan lakukan permintaan reset password baru",
        });
      }

      // Jika token tidak valid (rusak, salah tanda tangan, dsb)
      if (err.name === "JsonWebTokenError") {
        return res.status(400).json({
          status: false,
          message: "Token tidak valid, silakan coba lagi",
        });
      }

      // Error lainnya
      return res.status(500).json({
        status: false,
        message: "Terjadi kesalahan saat memverifikasi token",
        error: err.message,
      });
    }

    // 3️⃣ Ambil ID user dari token yang sudah berhasil diverifikasi
    const userId = decoded.id;

    // 4️⃣ Cari user berdasarkan ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User tidak ditemukan" });
    }

    // 5️⃣ Validasi password baru
    if (!password || password.length < 6) {
      return res.status(400).json({
        status: false,
        message: "Password baru tidak boleh kosong dan minimal 6 karakter",
      });
    }

    // 6️⃣ Hash password baru dan simpan
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    // 7️⃣ Tambahkan notifikasi ke user
    user.userNotification.push({
      notificationTitle: "Reset Password Berhasil",
      statusNotification: "informasi",
      description: `Password kamu berhasil direset pada ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}.`,
      timeStamp: new Date(),
    });

    await user.save();

    // 8️⃣ Respon sukses
    return res.status(200).json({
      status: true,
      message: "Password berhasil diubah",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
});

// ==========================
// CONTENT MANAGEMENT USER RUTE
// ==========================

// =====  1. Tambah Alamat (Bisa untuk edit alamat juga) =====
router.put('/address', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      provinsi,
      kabupatenOrKota,
      kecamatan,
      desaOrKelurahan,
      kodePos,
      detail,
      detailOpsional,
      gMapsAddress
    } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        address: {
          provinsi,
          kabupatenOrKota,
          kecamatan,
          desaOrKelurahan,
          kodePos,
          detail,
          detailOpsional,
          gMapsAddress
        }
      },
      { new: true } // supaya mengembalikan data user yang sudah diperbarui
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    return res.status(200).json({
      message: 'Alamat berhasil diperbarui',
      user: updatedUser.address
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Terjadi kesalahan saat memperbarui alamat',
      error: error.message
    });
  }
});

// =====  2. Ubah Password  =====
router.patch("/update-password", verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Harap isi password lama dan password baru", success: false });
    }

    // Cari user berdasarkan id
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan", success: false });
    }

    // Cek apakah password lama sesuai
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password lama salah", success: false });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    return res.status(200).json({
      message: "Password berhasil diperbarui",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Gagal memperbarui password",
      success: false,
      error: error.message,
    });
  }
});

// =====  3. Edit Profile  =====
router.patch("/edit", verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body; // Hanya field yang dikirim akan diproses

    // Cari user berdasarkan id
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan", success: false });
    }

    // Cek email unik jika ada di body
    if (updates.email && updates.email !== user.email) {
      const existingEmail = await User.findOne({ email: updates.email });
      if (existingEmail) {
        return res.status(400).json({ message: "Email sudah digunakan", success: false });
      }
    }

    // Cek phone unik jika ada di body
    if (updates.phone && updates.phone !== user.phone) {
      const existingPhone = await User.findOne({ phone: updates.phone });
      if (existingPhone) {
        return res.status(400).json({ message: "Nomor handphone sudah digunakan", success: false });
      }
    }

    // Update hanya field yang dikirim
    Object.keys(updates).forEach((key) => {
      user[key] = updates[key];
    });

    await user.save();

    return res.status(200).json({
      message: "Profil berhasil diperbarui",
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Gagal memperbarui profil",
      success: false,
      error: error.message,
    });
  }
});

// ==========================
// CART USER RUTE
// ==========================

// =====  1. TAMBAH PRODUK KE KERANJANG  =====
router.post("/cart/add", verifyUser, async (req, res) => {
  try {
    const userId = req.user._id; // dari middleware verifyUser
    const { productId, quantity } = req.body;

    // Validasi input
    if (!productId) {
      return res.status(400).json({ message: "ID produk diperlukan." });
    }

    const qty = Number(quantity) > 0 ? Number(quantity) : 1;

    // Cari produk
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan." });
    }

    // Cek apakah produk aktif
    if (!product.isActive) {
      return res.status(400).json({ message: "Produk ini tidak aktif atau tidak tersedia." });
    }

    // Cek stok produk
    if (product.stock <= 0) {
      return res.status(400).json({ message: "Produk ini sedang kehabisan stok." });
    }

    // Cari user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }

    // Cek apakah produk sudah ada di keranjang
    const existingItem = user.cart.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      // Hitung total quantity setelah ditambahkan
      const newQuantity = existingItem.quantity + qty;

      if (newQuantity > product.stock) {
        return res.status(400).json({
          message: `Stok tidak mencukupi. Stok tersedia: ${product.stock}, jumlah di keranjang akan menjadi ${newQuantity}.`,
        });
      }

      existingItem.quantity = newQuantity;
    } else {
      // Cek jika quantity yang diminta melebihi stok saat awal ditambahkan
      if (qty > product.stock) {
        return res.status(400).json({
          message: `Stok tidak mencukupi. Stok tersedia: ${product.stock}, sedangkan anda meminta ${qty}.`,
        });
      }

      user.cart.push({ product: productId, quantity: qty });
    }

    await user.save();

    // Populate untuk kirim data produk yang lengkap
    const updatedUser = await User.findById(userId).populate("cart.product");

    res.status(200).json({
      success: true,
      message: "Produk berhasil ditambahkan ke keranjang.",
      cart: updatedUser.cart,
    });
  } catch (error) {
    console.error("❌ Error menambahkan ke keranjang:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menambahkan ke keranjang.",
      error: error.message,
    });
  }
});

// =====  2. MENDAPATKAN DATA DAFTAR PRODUK DALAM KERANJANG  =====
router.get('/cart', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, brand, category, gender } = req.query;

    const user = await User.findById(userId).populate('cart.product');
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Hapus item keranjang yang produknya sudah tidak ada
    const validCart = user.cart.filter(item => item.product !== null);
    if (validCart.length !== user.cart.length) {
      user.cart = validCart;
      await user.save();
    }

    // Jika tidak ada query, kembalikan semua item
    if (!name && !brand && !category && !gender) {
      return res.status(200).json({
        message: "Berhasil mengambil semua produk di keranjang",
        cart: validCart
      });
    }

    // Lakukan filter dinamis
    const filteredCart = validCart.filter(item => {
      const product = item.product;
      let isMatch = true;

      if (name) {
        const regex = new RegExp(name, 'i');
        isMatch = isMatch && regex.test(product.name);
      }

      if (brand) {
        const regex = new RegExp(brand, 'i');
        isMatch = isMatch && regex.test(product.brand);
      }

      if (category) {
        const regex = new RegExp(category, 'i');
        isMatch = isMatch && regex.test(product.category);
      }

      if (gender) {
        isMatch = isMatch && product.gender === gender;
      }

      return isMatch;
    });

    if (filteredCart.length === 0) {
      return res.status(404).json({
        message: "Tidak ada produk di keranjang yang cocok dengan filter"
      });
    }

    res.status(200).json({
      message: "Berhasil mengambil data produk sesuai filter",
      cart: filteredCart
    });

  } catch (error) {
    console.error("Error mengambil keranjang:", error);
    res.status(500).json({
      message: "Gagal mengambil data keranjang",
      error: error.message
    });
  }
});

// =====  3. HAPUS PRODUK DARI DAFTAR KERANJANG PENGGUNA  =====
router.delete('/cart/:productId', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const user = await User.findById(userId).populate('cart.product');
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Periksa apakah produk ada di dalam keranjang
    const productInCart = user.cart.find(
      item => item.product && item.product._id.toString() === productId
    );

    if (!productInCart) {
      return res.status(404).json({ message: "Produk tidak ditemukan di keranjang" });
    }

    // Hapus produk dari keranjang
    user.cart = user.cart.filter(
      item => item.product._id.toString() !== productId
    );
    await user.save();

    // Populate data produk yang tersisa di keranjang
    await user.populate({
      path: 'cart.product',
      select: 'name price stock productImagesURL'
    });

    res.status(200).json({
      message: "Produk berhasil dihapus dari keranjang",
      removedProductId: productId,
      cart: user.cart
    });

  } catch (error) {
    console.error("Error menghapus produk:", error);
    res.status(500).json({
      message: "Gagal menghapus produk dari keranjang",
      error: error.message
    });
  }
});

// =====  4. TAMBAH QUANTITY PRODUK DIKERANJANG  =====
router.patch('/cart/increase/:productId', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const user = await User.findById(userId).populate('cart.product');
    if (!user) return res.status(404).json({ message: "Pengguna tidak ditemukan" });

    const item = user.cart.find(item => item.product && item.product._id.toString() === productId);
    if (!item) return res.status(404).json({ message: "Produk tidak ditemukan di keranjang" });

    const product = item.product;
    if (!product.isActive) {
      return res.status(400).json({ message: "Produk tidak aktif" });
    }

    // Cek stok
    if (item.quantity >= product.stock) {
      return res.status(400).json({ message: "Stok produk tidak mencukupi" });
    }

    // Tambah quantity
    item.quantity += 1;
    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'name price stock productImagesURL'
    });

    res.status(200).json({
      message: "Quantity produk berhasil ditambah",
      productId,
      newQuantity: item.quantity,
      cart: user.cart
    });

  } catch (error) {
    console.error("Error menambah quantity produk:", error);
    res.status(500).json({ message: "Gagal menambah quantity produk", error: error.message });
  }
});

// =====  5. KURANG QUANTITY PRODUK DIKERANJANG =====
router.patch('/cart/decrease/:productId', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const user = await User.findById(userId).populate('cart.product');
    if (!user) return res.status(404).json({ message: "Pengguna tidak ditemukan" });

    const itemIndex = user.cart.findIndex(
      item => item.product && item.product._id.toString() === productId
    );
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Produk tidak ditemukan di keranjang" });
    }

    const item = user.cart[itemIndex];

    if (item.quantity > 1) {
      item.quantity -= 1;
    } else {
      // Jika quantity = 1, hapus produk dari keranjang
      user.cart.splice(itemIndex, 1);
    }

    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'name price stock productImagesURL'
    });

    res.status(200).json({
      message: item.quantity > 0
        ? "Quantity produk berhasil dikurangi"
        : "Produk dihapus dari keranjang",
      productId,
      newQuantity: item.quantity || 0,
      cart: user.cart
    });

  } catch (error) {
    console.error("Error mengurangi quantity produk:", error);
    res.status(500).json({ message: "Gagal mengurangi quantity produk", error: error.message });
  }
});

// ====== 6. MENDAPATKAN JUMLAH PRODUK UNIK DALAM KERANJANG  ======
router.get('/cart/count', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;

    // Temukan user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Hapus produk null jika ada
    const validCart = user.cart.filter(item => item.product !== null);
    if (validCart.length !== user.cart.length) {
      user.cart = validCart;
      await user.save();
    }

    // Hitung jumlah produk unik (bukan quantity)
    const totalProducts = validCart.length;

    res.status(200).json({
      message: "Berhasil menghitung jumlah produk di keranjang",
      totalProducts
    });

  } catch (error) {
    console.error("❌ Error mengambil jumlah produk di keranjang:", error);
    res.status(500).json({
      message: "Gagal mengambil jumlah produk di keranjang",
      error: error.message
    });
  }
});

// ==========================
// WISHLIST USER RUTE
// ==========================

// =====  1. TAMBAH/HAPUS PRODUK KEDALAM ATAU DARI WISHLIST  =====
router.patch("/wishlist/toggle/:productId", verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    // Validasi ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "ID produk tidak valid" });
    }

    // Cek produk
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    // Cek user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Cek apakah produk sudah ada di wishlist
    const index = user.wishlist.findIndex(
      (id) => id.toString() === productId
    );

    let actionMessage;

    if (index > -1) {
      // Jika sudah ada → hapus dari wishlist
      user.wishlist.splice(index, 1);
      actionMessage = "Produk berhasil dihapus dari wishlist";
    } else {
      // Jika belum ada → tambahkan ke wishlist
      user.wishlist.push(productId);
      actionMessage = "Produk berhasil ditambahkan ke wishlist";
    }

    await user.save();

    // Populate agar respons berisi detail produk
    const populatedUser = await User.findById(userId)
      .populate("wishlist", "name price stock productImagesURL");

    return res.status(200).json({
      success: true,
      message: actionMessage,
      wishlist: populatedUser.wishlist,
    });

  } catch (error) {
    console.error("❌ Error toggle wishlist:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memproses wishlist",
      error: error.message,
    });
  }
});

// =====  2. MENDAPATKAN DATA DAFTAR PRODUK DALAM WISHLIST  =====
router.get('/wishlist', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, brand, category, gender } = req.query;

    // Temukan user dan populate wishlist
    const user = await User.findById(userId).populate('wishlist');
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Hapus produk yang sudah tidak ada dari wishlist
    const validWishlist = user.wishlist.filter(product => product !== null);
    if (validWishlist.length !== user.wishlist.length) {
      user.wishlist = validWishlist.map(p => p._id); // simpan hanya ID yang valid
      await user.save();
    }

    // Jika tidak ada filter, kembalikan semua produk
    if (!name && !brand && !category && !gender) {
      return res.status(200).json({
        message: "Berhasil mengambil semua produk di wishlist",
        wishlist: validWishlist
      });
    }

    // Lakukan filter dinamis berdasarkan query
    const filteredWishlist = validWishlist.filter(product => {
      let isMatch = true;

      if (name) {
        const regex = new RegExp(name, 'i');
        isMatch = isMatch && regex.test(product.name);
      }

      if (brand) {
        const regex = new RegExp(brand, 'i');
        isMatch = isMatch && regex.test(product.brand);
      }

      if (category) {
        const regex = new RegExp(category, 'i');
        isMatch = isMatch && regex.test(product.category);
      }

      if (gender) {
        isMatch = isMatch && product.gender === gender;
      }

      return isMatch;
    });

    // Jika tidak ada hasil
    if (filteredWishlist.length === 0) {
      return res.status(404).json({
        message: "Tidak ada produk di wishlist yang cocok dengan filter"
      });
    }

    // Jika berhasil
    res.status(200).json({
      message: "Berhasil mengambil data produk sesuai filter",
      wishlist: filteredWishlist
    });

  } catch (error) {
    console.error("❌ Error mengambil wishlist:", error);
    res.status(500).json({
      message: "Gagal mengambil data wishlist",
      error: error.message
    });
  }
});

// =====  3. MENDAPATKAN TOTAL PRODUK DALAM WISHLIST  =====
router.get('/wishlist/count', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    // Hitung jumlah item di wishlist
    const totalWishlistItems = user.wishlist.length;

    res.status(200).json({ totalWishlistItems });
  } catch (error) {
    console.error("Error mengambil jumlah wishlist:", error);
    res.status(500).json({ message: "Gagal mengambil jumlah wishlist", error: error.message });
  }
});

// ==========================
// NOTIFICATION USER RUTE
// ==========================

// =====  1. MENDAPATKAN DATA NOTIFIKASI PENGGUNA (FILTER STATUS belum-dibaca" atau "sudah-dibaca")  =====
router.get('/notifications', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query; // "belum-dibaca" atau "sudah-dibaca"

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    let notifications = user.userNotification;

    // Jika query status diberikan, lakukan filter
    if (status) {
      notifications = notifications.filter(n => n.statusNotification === status);
    }

    res.status(200).json({
      message: "Berhasil mengambil notifikasi",
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Error mengambil notifikasi:", error);
    res.status(500).json({ message: "Gagal mengambil notifikasi", error: error.message });
  }
});

// =====  2. UBAH STATUS NOTIFIKASI MENJADI "sudah-dibaca"  =====
router.patch('/notifications/:notificationId/read', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    const notification = user.userNotification.id(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    }

    notification.statusNotification = "sudah-dibaca";
    await user.save();

    res.status(200).json({
      message: "Status notifikasi berhasil diubah menjadi sudah dibaca",
      notification,
    });
  } catch (error) {
    console.error("Error memperbarui notifikasi:", error);
    res.status(500).json({ message: "Gagal memperbarui notifikasi", error: error.message });
  }
});

// =====  3. UBAH SEMUA STATUS NOTIFIKASI MENJADI "sudah-dibaca"  =====
router.patch('/notifications/read-all', verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    if (!user.userNotification || user.userNotification.length === 0) {
      return res.status(200).json({ message: "Tidak ada notifikasi untuk diperbarui" });
    }

    // Ubah semua statusNotification menjadi "sudah-dibaca"
    user.userNotification.forEach(notification => {
      if (notification.statusNotification === "belum-dibaca") {
        notification.statusNotification = "sudah-dibaca";
      }
    });

    await user.save();

    res.status(200).json({
      message: "Semua notifikasi telah ditandai sebagai sudah dibaca",
      totalUpdated: user.userNotification.length
    });
  } catch (error) {
    console.error("Error memperbarui semua notifikasi:", error);
    res.status(500).json({
      message: "Gagal memperbarui semua notifikasi",
      error: error.message
    });
  }
});

// ==========================
// VOUCHER USER RUTE
// ==========================

// =====  1. CLAIM VOUCHER  =====
router.post("/claim/:voucherId", verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { voucherId } = req.params;

    //  1. Cek apakah voucher ada
    const voucher = await Voucher.findById(voucherId);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher tidak ditemukan.",
      });
    }

    //   Cek apakah voucher aktif
    if (!voucher.isActive) {
      return res.status(400).json({
        success: false,
        message: "Voucher ini tidak aktif atau sudah dinonaktifkan.",
      });
    }

    //   Cek apakah voucher sudah melewati batas klaim global
    if (voucher.claimedCount >= voucher.maxUse) {
      return res.status(400).json({
        success: false,
        message: "Voucher sudah mencapai batas klaim maksimal.",
      });
    }

    //   Cek apakah pengguna sudah pernah klaim voucher ini
    const userHasClaimed = await User.findOne({
      _id: userId,
      "vouchers.voucher": voucherId,
    });

    if (userHasClaimed) {
      return res.status(400).json({
        success: false,
        message: "Kamu sudah pernah mengklaim voucher ini.",
      });
    }

    //   Klaim voucher
    await User.findByIdAndUpdate(userId, {
      $push: { vouchers: { voucher: voucherId, isUsed: false } },
    });

    //   Tambahkan claimedCount
    voucher.claimedCount += 1;
    await voucher.save();

    return res.status(200).json({
      success: true,
      message: "Voucher berhasil diklaim.",
      voucher,
    });
  } catch (error) {
    console.error("❌ Error saat klaim voucher:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat klaim voucher.",
      error: error.message,
    });
  }
});

// =====  2. MENDAPATKAN DATA DAFTAR VOUCHER TERSEDIA  =====
router.get("/my-vouchers", verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;

    // Populate voucher dari koleksi Voucher
    const user = await User.findById(userId).populate({
      path: "vouchers.voucher",
      model: "Voucher",
      select: "title code description discountType discountValue expiryDate isActive",
    });

    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }

    // Filter jika kamu hanya ingin menampilkan voucher yang aktif
    const claimedVouchers = user.vouchers.map((v) => ({
      _id: v.voucher?._id,
      title: v.voucher?.title,
      code: v.voucher?.code,
      description: v.voucher?.description,
      discountType: v.voucher?.discountType,
      discountValue: v.voucher?.discountValue,
      expiryDate: v.voucher?.expiryDate,
      isActive: v.voucher?.isActive,
      isUsed: v.isUsed,
      claimedAt: v.claimedAt,
    }));

    return res.status(200).json({
      message: "Daftar voucher yang sudah kamu klaim.",
      vouchers: claimedVouchers,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Gagal mengambil daftar voucher.",
      error,
    });
  }
});

// ==========================
// GET USER DATA RUTE
// ==========================

// =====  1. Data Pribadi  =====
router.get('/get-user', verifyUser, async(req,res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    res.status(200).json({message:"Berhasil Medapatkan Pengguna", data: user})
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal Menemukan Pengguna",
      error: error.message
    });
  }
})


export { router as userRouter };
