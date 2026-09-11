import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { Email, Password, Username } = req.body;

  try {
    if (!Email || !Password || !Username) {
      return res.status(400).json({
        message: "Username, email and password are required",
      });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);

    await User.create({
      Email,
      Username,
      Password: hashedPassword,
      Bio: " ",
      FollowersCount: 0,
      FollowingCount: 0,
      Followers: [],
      Following: [],
    });

    return res.status(200).json({
      message: "Signed up",
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      message: "Server Error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      return res.status(400).json({
        message: "both mail and password needed",
      });
    }

    const admin = await User.findOne({
      Email: Email,
    });

    if (!admin) {
      return res.status(404).json({
        message: "No account found",
      });
    }

    const MatchedPassword = bcrypt.compare(Password, admin.Password);

    if (!MatchedPassword) {
      return res.status(401).json({
        message: "Incorrect Password",
      });
    }

    const token = await jwt.sign({ userId: admin._id }, "userIdKey", {
      expiresIn: "90d",
    });
    res.cookie("jwt", token, {
      maxAge: 1000 * 60 * 60 * 24 * 90,
      secure: true,
      sameSite: "none",
      httpOnly: true,
    });
    res.status(200).json({
      message: "Logged in",
      admin: { ...admin.toObject(), Password: undefined },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

export default router;
