// ./models/Voucher.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const VoucherSchema = new Schema({
  title: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: String,
  
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true },

  minPurchase: { type: Number, default: 0 },
  expiryDate: { type: Date, required: true },

  // Maksimal nilai diskon (misalnya 5% maksimal Rp10.000)
  maxDiscountValue: { type: Number, default: 0 },

  // Jumlah user yang sudah menggunakan
  usedCount: { type: Number, default: 0 },

  // Jumlah maksimal penggunaan voucher secara global
  maxUse: { type: Number, default: 1 },

  // Jumlah pengguna yang sudah menggunakan kupon
  claimedCount: { type: Number, default: 0 },

  // Apakah voucher ini dibuat otomatis (new user) atau manual (event)
  type: { type: String, enum: ["newUser", "event"], default: "event" },

  isActive: { type: Boolean, default: true },

}, { timestamps: true });


export const Voucher = model("Voucher", VoucherSchema);
