// ./models/Product.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ProductSchema = new Schema({
  name: { type: String, required: true },
  brand: { type: String, required: true },
  category: { type: String, required: true }, // sepatu, baju, topi, dll
  description: String,
  price: { type: Number, required: true },
  discountPrice: Number,
  stock: { type: Number, required: true },
  productImages: [String],
  productImagesURL: [String],
  soldCount: { type: Number, default: 0 },
  tags: [String],

  colorOptions: [{
      color : String,
      image : String,
      imageURL : String,
  }],

  sizeOptions: [{
      size : String,
      image : String,
      imageimageURL : String,
  }],

  gender: { type: String, enum: ["men", "women", "kids", "unisex"] },
  modelType: { type: String }, // kasual, formal, sport
  attributes: {
    material: String,
    weight: String,
    dimensions: String,
  },

  //  field average rating (0-5)
  averageRating: { type: Number, default: 0, min: 0, max: 5 },

  // Jumlah total review untuk efisiensi query
  totalReviews: { type: Number, default: 0 },

  // Relasi ke Review tetap dipertahankan
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],

  // Status produk aktif/nonaktif
  isActive: { type: Boolean, default: true },
}, { timestamps: true });


export const Product = model("Product", ProductSchema);
