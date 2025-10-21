// ./models/Admin.js

import mongoose from "mongoose";
const {Schema, model} = mongoose;

const AdminSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true  },
}, { timestamps: true });

export const Admin = model("Admin", AdminSchema)