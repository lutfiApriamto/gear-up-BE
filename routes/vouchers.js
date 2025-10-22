// .\routes\vouchers.js
import express from 'express';
import { Voucher } from '../models/Voucher.js';
import { User } from '../models/User.js';
import { verifyAdmin, verifyUser } from '../middlewares/auth.js';
import { parsePagination } from '../middlewares/parsePagination.js';
const router = express.Router();

// ==========================
// CONTENT MANAGEMENT VOUCHER RUTE
// ==========================

// =====  1. Tambah Voucher =====
router.post("/add", verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      code,
      description,
      discountType,
      discountValue,
      minPurchase,
      expiryDate,
      maxDiscountValue,
      maxUse,
      type,
    } = req.body;

    // Validasi input dasar
    if (!title || !code || !discountType || !discountValue || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Data voucher tidak lengkap. Pastikan semua field wajib diisi.",
      });
    }

    // Validasi nilai diskon
    if (discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Nilai diskon harus lebih dari 0.",
      });
    }

    if (discountType === "percentage" && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: "Diskon persen tidak boleh lebih dari 100%.",
      });
    }

    // Validasi tanggal kedaluwarsa
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime()) || expiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Tanggal kedaluwarsa tidak valid atau sudah lewat.",
      });
    }

    // Cek apakah kode voucher sudah digunakan (case-insensitive)
    const existingVoucher = await Voucher.findOne({
      code: { $regex: new RegExp(`^${code}$`, "i") }
    });

    if (existingVoucher) {
      return res.status(400).json({
        success: false,
        message: `Kode voucher '${code}' sudah terdaftar. Gunakan kode lain.`,
      });
    }

    // Membuat voucher baru
    const newVoucher = new Voucher({
      title,
      code,
      description,
      discountType,
      discountValue,
      minPurchase: minPurchase || 0,
      expiryDate: expiry,
      maxDiscountValue: maxDiscountValue || 0,
      maxUse: maxUse || 1,
      type: type || "event",
    });

    await newVoucher.save();

    return res.status(201).json({
      success: true,
      message: "Voucher berhasil dibuat.",
      voucher: newVoucher,
    });
  } catch (error) {
    console.error("❌ Error saat membuat voucher:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
});

// =====  2. Hapus Voucher =====
router.delete("/delete/:voucherId", verifyAdmin, async (req, res) => {
  try {
    const { voucherId } = req.params;

    const voucher = await Voucher.findByIdAndDelete(voucherId);
    if (!voucher) {
      return res.status(404).json({ message: "Voucher tidak ditemukan." });
    }

    // Hapus dari semua user yang sudah klaim
    await User.updateMany(
      {},
      { $pull: { vouchers: { voucher: voucherId } } }
    );

    return res.status(200).json({
      message: "Voucher berhasil dihapus dari sistem dan semua pengguna.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat menghapus voucher.",
      error,
    });
  }
});

// =====  3. Ubah Status Voucher =====
router.patch("/:voucherId/toggle", verifyAdmin, async (req, res) => {
  try {
    const { voucherId } = req.params;
    const voucher = await Voucher.findById(voucherId);

    if (!voucher) {
      return res.status(404).json({ message: "Voucher tidak ditemukan." });
    }

    voucher.isActive = !voucher.isActive;
    await voucher.save();

    return res.status(200).json({
      message: `Status voucher berhasil diubah menjadi ${
        voucher.isActive ? "aktif" : "nonaktif"
      }.`,
      voucher,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat mengubah status voucher.",
      error,
    });
  }
});

// =====  4. Edit Data Voucher =====
router.put("/edit/:voucherId", verifyAdmin, async (req, res) => {
  try {
    const { voucherId } = req.params;
    const updatedData = req.body;

    // 🔹 1. Cek apakah voucher ada
    const existingVoucher = await Voucher.findById(voucherId);
    if (!existingVoucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher tidak ditemukan.",
      });
    }

    // 🔹 2. Validasi opsional

    // Jika admin mengirim code baru → pastikan tidak duplikat dengan voucher lain
    if (updatedData.code && updatedData.code !== existingVoucher.code) {
      const duplicate = await Voucher.findOne({
        _id: { $ne: voucherId },
        code: { $regex: new RegExp(`^${updatedData.code}$`, "i") },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Kode voucher '${updatedData.code}' sudah digunakan oleh voucher lain.`,
        });
      }
    }

    // Jika admin mengirim discountValue → validasi angka
    if (updatedData.discountValue !== undefined) {
      if (updatedData.discountValue <= 0) {
        return res.status(400).json({
          success: false,
          message: "Nilai diskon harus lebih dari 0.",
        });
      }

      // Jika type 'percentage', pastikan ≤ 100
      const type = updatedData.discountType || existingVoucher.discountType;
      if (type === "percentage" && updatedData.discountValue > 100) {
        return res.status(400).json({
          success: false,
          message: "Diskon persen tidak boleh lebih dari 100%.",
        });
      }
    }

    // Jika admin mengirim expiryDate → validasi tanggal
    if (updatedData.expiryDate) {
      const expiry = new Date(updatedData.expiryDate);
      if (isNaN(expiry.getTime()) || expiry < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Tanggal kedaluwarsa tidak valid atau sudah lewat.",
        });
      }
      updatedData.expiryDate = expiry; // konversi ke Date
    }

    // 🔹 3. Update voucher
    const voucher = await Voucher.findByIdAndUpdate(voucherId, updatedData, {
      new: true,
    });

    return res.status(200).json({
      success: true,
      message: "Voucher berhasil diperbarui.",
      voucher,
    });
  } catch (error) {
    console.error("❌ Error saat memperbarui voucher:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat memperbarui voucher.",
      error: error.message,
    });
  }
});

// ==========================
// GET VOUCHER DATA RUTE
// ==========================

// ===== 1. DETAIL VOUCHER =====
router.get('/get-voucher/:voucherId', async(req,res)=> {
  try {
    const voucher = await Voucher.findById(req.params.voucherId)
    return res.status(200).json({message:"Berhasil Mendapatkan Data Voucher", data : voucher})
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal Mendapatkan Data Voucher",
      error: error.message
    });
  }
})

// ===== 2. SEMUA DATA VOUCHER =====
router.get("/get-vouchers", parsePagination, async (req, res) => {
  try {
    const { limit, page, skip } = req.pagination;
    const { title, discountType, type } = req.query;

    // 🔹 1. Bangun query filter dinamis
    const query = {};

    if (title) {
      query.title = { $regex: title, $options: "i" }; // pencarian fuzzy (tidak case sensitive)
    }

    if (discountType) {
      query.discountType = discountType; // harus persis sesuai enum
    }

    if (type) {
      query.type = type; // event / newUser
    }

    // 🔹 2. Hitung total data sesuai query
    const total = await Voucher.countDocuments(query);

    // 🔹 3. Ambil data voucher dengan pagination
    const vouchers = await Voucher.find(query)
      .sort({ createdAt: -1 }) // urutkan dari yang terbaru
      .skip(skip)
      .limit(limit);

    // 🔹 4. Kirim respons
    res.status(200).json({
      success: true,
      message: "Data voucher berhasil diambil.",
      data: {
        pagination: {
          total,
          limit,
          page,
          totalPages: Math.ceil(total / limit),
        },
        vouchers,
      },
    });
  } catch (error) {
    console.error("❌ Gagal mengambil data voucher:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data voucher.",
      error: error.message,
    });
  }
});

export { router as voucherRouter };
