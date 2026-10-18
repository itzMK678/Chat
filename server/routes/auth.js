import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const sendTokenCookie = (user, res) => {
  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET || "default_jwt_secret_change_in_production",
    { expiresIn: "7d" }
  );

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const sanitizedUser = user.toObject ? user.toObject() : { ...user };
  delete sanitizedUser.password;

  return res.json({ success: true, user: sanitizedUser });
};

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;

    if (!username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Fill all required fields.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ username: username.trim() }, { email: email.trim().toLowerCase() }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with that username or email already exists.",
      });
    }

    let avatarUrl = "";

    // Safe avatar upload to ImgBB if base64 provided
    if (avatar && avatar.includes(",")) {
      try {
        const formData = new URLSearchParams();
        formData.append("image", avatar.split(",")[1]);

        const response = await fetch(
          "https://api.imgbb.com/1/upload?key=a1f1d17afbe7aeeba81aea8797b1f27",
          { method: "POST", body: formData }
        );

        const data = await response.json();
        if (data.success && data.data && data.data.url) {
          avatarUrl = data.data.url;
        }
      } catch (uploadErr) {
        console.warn("Avatar upload to ImgBB failed, continuing without it:", uploadErr.message);
      }
    } else if (typeof avatar === "string") {
      avatarUrl = avatar;
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      avatar: avatarUrl,
    });

    await user.save();
    return sendTokenCookie(user, res);
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Enter username and password.",
      });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // Compare with bcrypt
    let isMatch = await bcrypt.compare(password, user.password);

    // Seamless migration for legacy accounts that had plaintext passwords
    if (!isMatch && password === user.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    return sendTokenCookie(user, res);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get current logged-in user from session cookie
router.get("/me", protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// Logout and clear cookie
router.post("/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
  res.json({ success: true, message: "Logged out successfully." });
});

export default router;
