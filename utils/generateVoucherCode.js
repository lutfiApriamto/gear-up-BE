// utils/generateVoucherCode.js
import { Voucher } from "../models/Voucher.js";

/**
 * Membuat kode voucher yang unik berdasarkan nama pengguna.
 * Jika ditemukan duplikasi di database, fungsi akan regenerate kode hingga unik.
 *
 * @param {string} name - Nama pengguna atau identifier untuk pembentuk kode.
 * @returns {Promise<string>} - Mengembalikan kode voucher yang unik.
 */
export async function generateUniqueVoucherCode(name) {
  let voucherCode;
  let isUnique = false;

  while (!isUnique) {
    // Membentuk kode: WELCOME-[NAMA]-[6-digit-random]
    voucherCode = `WELCOME-${name.toUpperCase().replace(/\s/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Cek ke database apakah kode sudah pernah digunakan
    const existingVoucher = await Voucher.findOne({ voucherCode });
    if (!existingVoucher) {
      isUnique = true;
    }
  }

  return voucherCode;
}
