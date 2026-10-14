import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// PATCH /profile/:userId
router.patch("/:userId", async (req, res) => {
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
          message: "Current password is required.",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters.",
        });
      }

      const passwordMatches = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!passwordMatches) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }

      user.password = await bcrypt.hash(newPassword, 12);
    }

    user.username = username.trim();

    if (typeof avatar === "string") {
      user.avatar = avatar;
    }

    await user.save();

    // Never send the password hash to the frontend.
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
        message: "That username or another unique field is already in use.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

export default router;