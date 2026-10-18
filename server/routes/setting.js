import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// PATCH /profile/:userId (Protected - user can only update their own profile)
router.patch("/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      username,
      avatar,
      currentPassword,
      newPassword,
    } = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    // Only allow editing your own profile
    if (String(req.user._id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile.",
      });
    }

    if (!username?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Verify the existing password before changing it.
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set a new password.",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters.",
        });
      }

      let passwordMatches = await bcrypt.compare(
        currentPassword,
        user.password
      );

      // Support legacy unhashed password verification
      if (!passwordMatches && currentPassword === user.password) {
        passwordMatches = true;
      }

      if (!passwordMatches) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    user.username = username.trim();

    if (typeof avatar === "string") {
      user.avatar = avatar;
    }

    await user.save();

    // Never send password to frontend
    const updatedUser = user.toObject();
    delete updatedUser.password;

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That username is already taken.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

export default router;