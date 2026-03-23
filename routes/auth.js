const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@test.com" && password === "123456") {
    const token = jwt.sign(
      { email: email },
      "secretkey",
      { expiresIn: "1h" }
    );

    return res.json({
      token,
      hotel: {
        name: "Demo Hotel"
      }
    });
  }

  res.status(401).json({ message: "Invalid credentials" });
});

module.exports = router;