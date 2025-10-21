// ./middlewares/auth.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Admin } from '../models/Admin.js';
import { User } from '../models/User.js'; 
dotenv.config();

export const verifyUser = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token tidak ditemukan' });
        }

        const decoded = jwt.verify(token, process.env.KEY);
        const user = await User.findById(decoded._id);

        if (!user) {
            return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
        }

        if (user.role !== 'user') {
            return res.status(403).json({ message: 'Akses ditolak. role Anda bukan user' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.log(error);
        return res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa' });
    }
};

export const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token tidak ditemukan' });
        }

        const decoded = jwt.verify(token, process.env.KEY);
        const admin = await Admin.findById(decoded._id);

        if (!admin) {
            return res.status(404).json({ message: 'Admin tidak ditemukan' });
        }

        if (admin.role !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak. Anda bukan admin' });
        }

        req.admin = admin;
        next();
    } catch (error) {
        console.log(error);
        return res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa' });
    }
};