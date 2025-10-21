// ./models/User.js

import mongoose from "mongoose";
const {Schema, model} = mongoose;

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  status: { type: String, required: true , enum: ['aktif', 'banned'], default: 'aktif'},
  role: { type: String, required: true },
  photoProfile : String,
  photoURL : String,
  address : {
    provinsi : String,
    kabupatenOrKota : String,
    kecamatan : String,
    desaOrKelurahan : String,
    kodePos : String,
    detail : String,
    detailOpsional : String,
    gMapsAddress: String,
  },

  cart: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1 }
  }],
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],

  vouchers: [{
  voucher: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },
  isUsed: { type: Boolean, default: false },
  claimedAt: { type: Date, default: Date.now }
  }],

  userNotification : [
    {
      notificationTitle : { type: String},
      statusNotification : { type: String},
      description : { type: String},
      timeStamp : {type: Date, default: Date.now},
    }
  ],
}, { timestamps: true });

export const User = model("User", UserSchema)

