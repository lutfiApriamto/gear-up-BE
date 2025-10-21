// ./models/Review.js

import mongoose from "mongoose";
const {Schema, model} = mongoose;

const ReviewSchema = Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

ReviewSchema.index({ user: 1, product: 1 }, { unique: true });


export const Review = model("Review", ReviewSchema)
