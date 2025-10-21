// ./routes/admins.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.js';
import { verifyUser, verifyAdmin } from '../middlewares/auth.js';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { parsePagination } from '../middlewares/parsePagination.js';
dotenv.config();

const router = express.Router();

// ==========================
// AUTH ADMIN RUTE
// ==========================

// =====  1. Registrasi =====
router.post('/register', async (req, res) => {
  const {name, email,password, phone} = req.body;
  const validateEmail = await Admin.findOne({email})
  const validatePhone = await Admin.findOne({phone})
  if (validateEmail) {
    return res.status(400).json({message:"Email Sudah Terdaftar", status : false})
  }

  if (validatePhone) {
    return res.status(400).json({message:"Nomor Handphone Sudah Terdaftar", status : false})
  }
  try {
    const hashedPassword = await bcrypt.hash(password,10)
    const newAdmin = new Admin({
      name,
      email,
      password : hashedPassword,
      phone,
      role : "admin"
    })

    await newAdmin.save()

    return res.status(200).json({message:"Berhasil Menambahkan Admin", newAdmin})
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal Menambahkan Admin",
      error: error.message
    });
  }
});

// ===== 2. Login =====
router.post('/login', async(req,res) => {
  const {email, password}= req.body;
  try {
    const admin = await Admin.findOne({email})
    if(!admin){
      return res.status(400).json({meesage : "Admin Tidak Ditemukan"})
    }

    const validPassword = await bcrypt.compare(password, admin.password)
    if(!validPassword){
      return res.status(400).json({message : "Email Atau Password yang anda Masukan Salah"});
    }

    const token = jwt.sign(
      { name: admin.name, role: admin.role, _id : admin._id },
      process.env.KEY,
      { expiresIn: "7d" }
    );

    // Simpan token di cookie
    res.cookie("token", token, {
      httpOnly: true,      // tidak bisa diakses JS
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 hari (ms)
    });

    const role = admin.role
    const name = admin.name

    return res.status(200).json({message : "Berhasil melakukan Login", token, role, name})

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan login Admin",
      error: error.message
    });
  }
})

// ===== 3. Forgot Password =====
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // 1️⃣ Cek apakah email admin terdaftar
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ status: false, message: "Akun admin tidak ditemukan." });
    }

    // 2️⃣ Buat token JWT (berlaku 10 menit)
    const token = jwt.sign({ id: admin._id }, process.env.KEY, { expiresIn: "10m" });

    // 3️⃣ Buat transporter untuk mengirim email (pakai akun Gmail dari .env)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 4️⃣ Template Email - Tema GEARUP, tapi untuk Admin
    const mailOptions = {
      from: `"GEARUP Admin Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Password Admin - GEARUP",
      html: `
      <div style="font-family: Arial, sans-serif; background-color: #EDFAF2; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #FFFFFF; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border: 1px solid #DEDEDE;">
          
          <!-- Header -->
          <div style="background-color: #00BA47; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0;">GEARUP ADMIN</h1>
            <p style="margin: 0;">STEP IN. GEAR UP.</p>
          </div>

          <!-- Body -->
          <div style="padding: 30px; color: #333; text-align: center;">
            <h2 style="color: #00BA47;">Permintaan Reset Password Admin</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #444;">
              Halo <strong>${admin.name}</strong>, kami menerima permintaan untuk mereset password akun admin kamu.  
              Klik tombol di bawah ini untuk melanjutkan proses reset password akun admin GEARUP.
            </p>

            <div style="margin: 25px 0;">
              <a href="${process.env.CLIENT_URL}/reset-password/admin/${token}"
                style="display: inline-block; background-color: #00BA47; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
                Reset Password
              </a>
            </div>

            <p style="font-size: 14px; color: #666; line-height: 1.5;">
              Link ini hanya berlaku selama <strong>10 menit</strong>.  
              Jika kamu tidak merasa meminta reset password, abaikan email ini dan akun kamu tetap aman.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #F5F5F5; padding: 15px; text-align: center; font-size: 12px; color: #777;">
            © ${new Date().getFullYear()} GEARUP Admin Panel. All rights reserved.
          </div>

        </div>
      </div>
      `,
    };

    // 5️⃣ Kirim email menggunakan transporter
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ status: false, message: "Gagal mengirim email reset password admin." });
      } else {
        return res.status(200).json({
          status: true,
          message: "Email reset password admin telah dikirim. Silakan periksa inbox atau folder spam Anda.",
        });
      }
    });
  } catch (error) {
    console.error("Forgot password admin error:", error);
    res.status(500).json({
      status: false,
      message: "Terjadi kesalahan saat memproses permintaan reset password admin.",
      error: error.message,
    });
  }
});

// ===== 4. Forgot Password =====
router.post('/reset-password', async (req, res) => {
    const { password, token } = req.body;

    try {
        const decoded = jwt.verify(token, process.env.KEY);
        const userId = decoded.id;

        const user = await Admin.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const hashpassword = await bcrypt.hash(password, 10); 
        user.password = hashpassword;
        await user.save();

        return res.json({status : true, message: "Password berhasil diubah" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
});

// ==========================
// GET ADMIN DATA RUTE
// ==========================

// =====  1. Data Pribadi  =====
router.get('/get-admin', verifyAdmin, async(req,res) => {
  try {
    const adminID = req.admin._id;
    const admin = await Admin.findById(adminID);
    res.status(200).json({message:"Berhasil Medapatkan Admin", data: admin})
  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      message: "Gagal Mendapatkan Admin",
      error: error.message
    });
  }
})

// =====  1. Semua Data Admin Pribadi  =====
router.get('/get-admins', verifyAdmin, parsePagination, async(req,res)=> {
  try {
    const { limit, page, skip } = req.pagination;
    const {name} = req.query;
    const query = {}

    if (name) {
      query.name = { $regex: name, $options: 'i' }
    }

    const total = await Admin.countDocuments(query)
    const admin = await Admin.find(query)
      .sort({ name: 1 }) // urutkan A → Z
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data: {
        pagination: {
          total,
          limit,
          page,
          totalPages: Math.ceil(total / limit)
        },
        admin
      }
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      message: "Gagal Mendapatkan Admin",
      error: error.message
    });
  }
})

export {router as AdminRouter}
