import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Helper function to create JWT and attach HTTP-only cookie
const sendTokenResponse = (user, res) => {
  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // Cookie valid for 7 days
  );

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,              // Prevents JavaScript access (XSS safe)
    secure: isProduction,        // HTTPS only in production
    sameSite: isProduction ? "none" : "lax", 
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  });

  // Return user without password
  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;

  res.json({ success: true, user: sanitizedUser });
};

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;
    // ... validation ...

    // 1. Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      avatar: avatarUrl
    });
    await user.save();

    // 2. Set cookie & return response
    sendTokenResponse(user, res);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    // 1. Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    // 2. Set cookie & return response
    sendTokenResponse(user, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true, message: "Logged out" });
});