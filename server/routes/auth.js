const express = require("express");
const router = express.Router();
const User = require("../models/User");


// Signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Fill all required fields" });
    }

    let avatarUrl = "";

    // Safe avatar upload
    if (avatar && avatar.includes(",")) {
      const formData = new URLSearchParams();
      formData.append("image", avatar.split(",")[1]);

      const response = await fetch(
        "https://api.imgbb.com/1/upload?key=a1f1d17afbe7aeeba81aea8797b1f27",
        { method: "POST", body: formData }
      );

      const data = await response.json();
      console.log("ImgBB response:", data); // ✅ log to debug

      if (data.success && data.data && data.data.url) {
        avatarUrl = data.data.url;
      } else {
        console.warn("ImgBB upload failed:", data);
        avatarUrl = ""; // fallback
      }
    }

    const user = new User({ username, email, password, avatar: avatarUrl });
    await user.save();
    res.json({ success: true, user });

  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
// Login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Enter username and password" });
        }

        const user = await User.findOne({ username, password });
        if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
