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
