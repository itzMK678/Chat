import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Message from "../models/Message.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure audio file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const extension = file.mimetype.includes("mp4")
      ? ".m4a"
      : file.mimetype.includes("ogg")
      ? ".ogg"
      : ".webm";
    const uniqueName = `voice-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, uniqueName);
  },
});

// Accept audio files only, with a 10 MB limit
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed."));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Send a text message (Protected)
router.post("/", protect, async (req, res) => {
  try {
    const { receiver, text } = req.body;
    const sender = req.user._id; // Guaranteed to be the authenticated user

    if (!receiver || !text?.trim()) {
      return res.status(400).json({
        message: "Receiver and text are required.",
      });
    }

    const message = new Message({
      sender,
      receiver,
      text: text.trim(),
      type: "text",
    });

    await message.save();
    res.status(201).json(message);
  } catch (err) {
    console.error("Save message error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
});

// Upload and send a voice message (Protected)
router.post("/voice", protect, upload.single("audio"), async (req, res) => {
  try {
    const { receiver } = req.body;
    const sender = req.user._id; // Guaranteed to be the authenticated user

    if (!receiver) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: "Receiver is required.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please upload an audio file.",
      });
    }

    const message = new Message({
      sender,
      receiver,
      text: "",
      type: "voice",
      audioUrl: `/uploads/${req.file.filename}`,
    });

    await message.save();
    res.status(201).json(message);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Save voice message error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
});

// Get messages between two users (Protected - user must be a participant)
router.get("/:user1/:user2", protect, async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const currentUserId = String(req.user._id);

    // Verify requesting user is either user1 or user2
    if (currentUserId !== String(user1) && currentUserId !== String(user2)) {
      return res.status(403).json({
        message: "Not authorized to view this chat history.",
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
});

export default router;
