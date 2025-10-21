// ./routes/admins.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

router.post('/add-admin', async (req, res) => {
  const {name, email,password, phone} = req.body;
  const validateEmail = await Admins.findOne({email})
  const validatePhone = await Admins.findOne({phone})
  if (validateEmail) {
    return res.status(400).json({message:"Email Sudah Terdaftar", status : false})
  }

  if (validatePhone) {
    return res.status(400).json({message:"Nomor Handphone Sudah Terdaftar", status : false})
  }
  try {
    const hashedPassword = await bcrypt.hash(password,10)
    const newAdmin = new Admins({
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

export {router as AdminRouter}
