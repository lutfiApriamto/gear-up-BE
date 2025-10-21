// ./routes/image.js
import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import supabase from "../middlewares/supabaseClient.js"; // file yang Anda buat
import { verifyAdmin } from "../middlewares/auth.js";
dotenv.config();

const router = express.Router();

// Multer (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * POST /image/upload
 * - protected (verifyKader)
 * - form field name: "image"
 * - returns: { fileName, filePath, fileURL }
 */
router.post("/upload", upload.single("image") ,async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { originalname, buffer, mimetype } = req.file;
    const ext = path.extname(originalname) || "";
    // buat nama file unik
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = fileName; // bisa tambahkan folder, mis. `trash-photos/${fileName}`

    // upload ke supabase
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("photos")
      .upload(filePath, buffer, { contentType: mimetype, upsert: false });

    if (uploadErr) {
      console.error("Supabase upload error:", uploadErr);
      return res.status(500).json({ message: "Upload to storage failed", error: uploadErr.message || uploadErr });
    }

    // coba dapatkan public URL; jika bucket private, fallback ke signed URL
    let fileURL = null;
    try {
      const { data: pubData } = supabase.storage.from("photos").getPublicUrl(filePath);
      fileURL = pubData?.publicUrl || null;
    } catch (e) {
      // ignore and try signed url
      fileURL = null;
    }

    if (!fileURL) {
      // fallback: signed url (60 detik)
      const expiresIn = 60; // detik — ubah sesuai kebutuhan
      const { data: signedData, error: signErr } = await supabase.storage
        .from("photos")
        .createSignedUrl(filePath, expiresIn);
      if (signErr) {
        console.error("Supabase createSignedUrl error:", signErr);
      } else {
        fileURL = signedData?.signedUrl || null;
      }
    }

    return res.status(200).json({
      message: "File uploaded",
      fileName,
      filePath,
      fileURL,
      uploadData,
    });
  } catch (err) {
    console.error("Upload route error:", err);
    return res.status(500).json({ message: "Upload failed", error: err.message || err });
  }
});

/**
 * GET /image/view/:fileName
 * - returns public/signed URL for file
 * - public if bucket public, otherwise returns signed url
 */
router.get("/view/:fileName", async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);
    if (!fileName) return res.status(400).json({ message: "fileName required" });

    // coba public url dulu
    let fileURL = null;
    try {
      const { data: pubData } = supabase.storage.from("photos").getPublicUrl(fileName);
      fileURL = pubData?.publicUrl || null;
    } catch (e) {
      fileURL = null;
    }

    if (!fileURL) {
      // fallback signed url
      const expiresIn = 60; // detik
      const { data: signedData, error: signErr } = await supabase.storage
        .from("photos")
        .createSignedUrl(fileName, expiresIn);
      if (signErr) {
        console.error("createSignedUrl error:", signErr);
        return res.status(500).json({ message: "Could not create file URL", error: signErr.message || signErr });
      }
      fileURL = signedData?.signedUrl;
    }

    return res.status(200).json({ fileName, fileURL });
  } catch (err) {
    console.error("View route error:", err);
    return res.status(500).json({ message: "Failed to get file URL", error: err.message || err });
  }
});

/**
 * DELETE /image/delete/:fileName
 * - protected (verifyKader)
 * - removes the object from supabase storage
 */
router.delete("/delete/:fileName" ,async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);
    if (!fileName) return res.status(400).json({ message: "fileName required" });

    const { data, error } = await supabase.storage.from("photos").remove([fileName]);
    if (error) {
      console.error("Supabase remove error:", error);
      return res.status(500).json({ message: "Failed to delete file", error: error.message || error });
    }

    return res.status(200).json({ message: "File deleted", data });
  } catch (err) {
    console.error("Delete route error:", err);
    return res.status(500).json({ message: "Failed to delete file", error: err.message || err });
  }
});

// POST /image/uploadMultiple
// form field name: "images" (bisa upload banyak file sekaligus)
router.post("/uploadMultiple" ,upload.array("images", 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }

        const uploadedFiles = [];

        for (const file of req.files) {
            const { originalname, buffer, mimetype } = file;
            const ext = path.extname(originalname) || "";
            const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
            const filePath = fileName;

            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from("photos")
                .upload(filePath, buffer, { contentType: mimetype, upsert: false });

            if (uploadErr) {
                console.error("Supabase upload error:", uploadErr);
                continue; // skip file yang gagal
            }

            let fileURL = null;
            try {
                const { data: pubData } = supabase.storage.from("photos").getPublicUrl(filePath);
                fileURL = pubData?.publicUrl || null;
            } catch (e) { fileURL = null; }

            if (!fileURL) {
                const expiresIn = 60;
                const { data: signedData, error: signErr } = await supabase.storage
                    .from("photos")
                    .createSignedUrl(filePath, expiresIn);
                if (signErr) console.error("Supabase createSignedUrl error:", signErr);
                else fileURL = signedData?.signedUrl || null;
            }

            uploadedFiles.push({ fileName, fileURL, uploadData });
        }

        return res.status(200).json({ message: "Files uploaded", uploadedFiles });
    } catch (err) {
        console.error("Upload multiple route error:", err);
        return res.status(500).json({ message: "Upload failed", error: err.message || err });
    }
});

export { router as imageRouter };
