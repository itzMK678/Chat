
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
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
        fileSize: 10 * 1024 * 1024
    }
});

// Send a text message
router.post("/", async (req, res) => {
    try {
        const { sender, receiver, text } = req.body;

        if (!sender || !receiver || !text?.trim()) {
            return res.status(400).json({
                message: "Sender, receiver, and text are required."
            });
        }

        const message = new Message({
            sender,
            receiver,
            text: text.trim(),
            type: "text"
        });

        await message.save();

        res.status(201).json(message);
    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
});

// Upload and send a voice message
router.post("/voice", upload.single("audio"), async (req, res) => {
    try {
        const { sender, receiver } = req.body;

        if (!sender || !receiver) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(400).json({
                message: "Sender and receiver are required."
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: "Please upload an audio file."
            });
        }

        const message = new Message({
            sender,
            receiver,
            text: "",
            type: "voice",
            audioUrl: `/uploads/${req.file.filename}`
        });

        await message.save();

        res.status(201).json(message);
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            message: err.message
        });
    }
});

// Get messages between two users
router.get("/:user1/:user2", async (req, res) => {
    try {
        const { user1, user2 } = req.params;

        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
});

module.exports = router;
