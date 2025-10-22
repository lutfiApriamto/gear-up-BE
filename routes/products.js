// .\routes\products.js
import express from 'express';
import { verifyAdmin } from '../middlewares/auth.js';
import { parsePagination } from '../middlewares/parsePagination.js';
import { Product } from '../models/Product.js';
import supabase from "../middlewares/supabaseClient.js"; 

const router = express.Router();

// ==========================
// CONTENT MANAGEMENT PRODUCT RUTE
// ==========================

/**
 * =====================================================
 * 1. Tambah Produk Baru
 * =====================================================
 * Method: POST
 * Endpoint: /add
 * Akses: Hanya untuk Admin
 * Deskripsi:
 * - Menambahkan produk baru ke database
 * - Semua field opsional akan tetap tersimpan jika dikirim
 * - Untuk file (gambar), frontend cukup kirim nama file & URL dari Supabase
 * =====================================================
 */
router.post("/add", verifyAdmin, async (req, res) => {
  try {
    // Destrukturisasi body yang dikirim dari frontend
    const {
      name,
      brand,
      category,
      description,
      price,
      discountPrice,
      stock,
      productImages,
      productImagesURL,
      soldCount,
      tags,
      colorOptions,
      sizeOptions,
      gender,
      modelType,
      attributes,
      isActive,
    } = req.body;

    // Validasi field yang wajib diisi
    if (!name || !brand || !category || !price || !stock) {
      return res.status(400).json({
        success: false,
        message: "Field wajib (name, brand, category, price, stock) harus diisi.",
      });
    }

    // Membuat instance produk baru
    const newProduct = new Product({
      name,
      brand,
      category,
      description,
      price,
      discountPrice,
      stock,
      productImages: productImages || [],
      productImagesURL: productImagesURL || [],
      soldCount: soldCount || 0,
      tags: tags || [],
      colorOptions: colorOptions || [],
      sizeOptions: sizeOptions || [],
      gender,
      modelType,
      attributes: {
        material: attributes?.material || "",
        weight: attributes?.weight || "",
        dimensions: attributes?.dimensions || "",
      },
      isActive: isActive !== undefined ? isActive : true,
    });

    // Simpan produk ke database
    await newProduct.save();

    // Kirimkan respons sukses
    return res.status(201).json({
      success: true,
      message: "Produk berhasil ditambahkan.",
      product: newProduct,
    });
  } catch (error) {
    console.error("❌ Error saat menambahkan produk:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
});

// ===== 2. HAPUS =====
router.delete('/delete/:productID', verifyAdmin, async(req,res) => {
  try {
    const product = await Product.findById(req.params.productID)
    if(!product){
      return res.status(404).json({message:"Produk tidak ditemukan"})
    }
    const deleteProduct = await Product.deleteOne({_id:req.params.productID})
    return res.status(201).json({message:"Berhasil Menghapus Prdoduk", deleteProduct})
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal Menghapus Produk",
      error: error.message
    });
  }
})

// ===== 3. EDIT =====
router.patch('/edit/:productID', verifyAdmin, async(req,res)=>{
  try {
    const updateProduct = await Product.updateOne({_id:req.params.productID}, {$set : req.body})
    return res.status(201).json({message: "Berhasil Mengupdate Product",  updateProduct})
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal Mengupdate Data Produk",
      error: error.message
    });
  }
})

// ===== 3. UBAH STATUS (AKTIF/TDK AKTIF) =====
router.patch("/toggle-status/:productID", verifyAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productID);

    // Jika produk tidak ditemukan
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan.",
      });
    }

    // Ubah status produk (true -> false, false -> true)
    product.isActive = !product.isActive;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Status produk berhasil diubah menjadi ${product.isActive ? "aktif" : "tidak aktif"}.`,
      product,
    });
  } catch (error) {
    console.error("Toggle status error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server saat mengubah status produk.",
      error: error.message,
    });
  }
});

// ===== 4. MEMBERIKAN HARGA DISCOUNT =====
router.patch("/set-discount/:productID", verifyAdmin, async (req, res) => {
  try {
    const { discountPrice } = req.body;

    // Validasi input discount
    if (discountPrice === undefined || discountPrice === null) {
      return res.status(400).json({
        success: false,
        message: "Harga diskon harus diisi.",
      });
    }

    if (typeof discountPrice !== "number" || discountPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Harga diskon harus berupa angka positif.",
      });
    }

    // Cari produk
    const product = await Product.findById(req.params.productID);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan.",
      });
    }

    // Cek apakah harga diskon lebih besar dari harga normal
    if (discountPrice >= product.price) {
      return res.status(400).json({
        success: false,
        message: "Harga diskon tidak boleh lebih tinggi atau sama dengan harga normal.",
      });
    }

    // Tambahkan atau perbarui field discountPrice
    product.discountPrice = discountPrice;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Harga diskon produk berhasil diperbarui.",
      product,
    });
  } catch (error) {
    console.error("Set discount error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server saat memperbarui harga diskon.",
      error: error.message,
    });
  }
});

// ===== 5. NON AKTIFKAN DISCOUNT =====
router.put("/disable-discount/:productID", async (req, res) => {
  try {
    const { productID } = req.params;

    // Cari produk berdasarkan ID
    const product = await Product.findById(productID);
    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    // Cek apakah produk memiliki discountPrice yang valid
    if (!product.discountPrice || product.discountPrice <= 0) {
      return res.status(400).json({
        message: "Produk ini tidak memiliki diskon aktif untuk dinonaktifkan",
      });
    }

    // Ubah discountPrice menjadi 0
    product.discountPrice = 0;
    await product.save();

    res.status(200).json({
      message: "Diskon produk berhasil dinonaktifkan",
      updatedProduct: product,
    });
  } catch (error) {
    console.error("Error disabling discount:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server" });
  }
});

// ==========================
// SKU (STOCK KEEPING UNIT) PRODUCT RUTE
// ==========================

// ===== 1. TAMBAH STOK PRODUK =====
router.patch('/add-stock/:productID', verifyAdmin, async (req, res) => {
  try {
    const { amount } = req.body;

    // Validasi nilai stok
    if (
      amount === undefined ||
      amount === null ||
      typeof amount !== 'number' ||
      isNaN(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Jumlah stok harus berupa angka positif dan tidak boleh kosong."
      });
    }

    // Cari dan update stok produk
    const product = await Product.findByIdAndUpdate(
      req.params.productID,
      { $inc: { stock: amount } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan."
      });
    }

    return res.status(200).json({
      success: true,
      message: `Stok berhasil ditambahkan sebanyak ${amount} unit.`,
      product
    });

  } catch (error) {
    console.error("Add stock error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menambahkan stok.",
      error: error.message
    });
  }
});

// ===== 2. KURANGI STOK PRODUK =====
router.patch('/reduce-stock/:productID', verifyAdmin, async (req, res) => {
  try {
    const { amount } = req.body;

    // Validasi nilai stok
    if (
      amount === undefined ||
      amount === null ||
      typeof amount !== 'number' ||
      isNaN(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Jumlah pengurangan harus berupa angka positif dan tidak boleh kosong."
      });
    }

    // Cari produk
    const product = await Product.findById(req.params.productID);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan."
      });
    }

    // Validasi stok cukup
    if (product.stock < amount) {
      return res.status(400).json({
        success: false,
        message: `Stok tidak mencukupi. Stok saat ini: ${product.stock}, permintaan pengurangan: ${amount}.`
      });
    }

    // Kurangi stok dan simpan
    product.stock -= amount;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Stok berhasil dikurangi sebanyak ${amount} unit.`,
      product
    });

  } catch (error) {
    console.error("Reduce stock error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengurangi stok.",
      error: error.message
    });
  }
});

// ==========================
// GET PRODUCT DATA RUTE
// ==========================

// ===== 1. DETAIL PRODUK =====
router.get('/get-product/:productID', async(req,res)=> {
  try {
    const product = await Product.findById(req.params.productID)
    return res.status(200).json({message:"Berhasil Mendapatkan Data Product", data : product})
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal Mendapatkan Data Produk",
      error: error.message
    });
  }
})

// ===== 2. MENDAPATKAN NILAI DISTINC BEDASARKAN QUERY FIELD =====
router.get("/distinct", async (req, res) => {
  try {
    const { field } = req.query;

    // Validasi wajib ada query field
    if (!field) {
      return res.status(400).json({
        success: false,
        message: "Parameter query 'field' wajib disertakan. Contoh: ?field=brand",
      });
    }

    // Daftar field yang diizinkan untuk distinct
    const allowedFields = [
      "brand",
      "category",
      "modelType",
      "gender",
      "tags",
      "attributes.material",
      "attributes.weight",
      "attributes.dimensions",
      "colorOptions.color",
      "sizeOptions.size",
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: `Field '${field}' tidak valid. Gunakan salah satu dari: ${allowedFields.join(", ")}`,
      });
    }

    // Jika field berasal dari subdokumen (contoh: colorOptions.color)
    const distinctValues = await Product.distinct(field, { isActive: true });

    // Hilangkan nilai kosong/null jika ada
    const filteredValues = distinctValues.filter((val) => val && val.trim && val.trim() !== "");

    return res.status(200).json({
      success: true,
      message: `Distinct '${field}' dari produk aktif berhasil diambil.`,
      count: filteredValues.length,
      values: filteredValues,
    });
  } catch (error) {
    console.error("❌ Error saat mengambil distinct:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
});

export { router as productRouter };
