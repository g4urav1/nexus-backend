import mongoose from "mongoose";
import express from "express";
import "dotenv/config";
import nodemailer from "nodemailer";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import multer from "multer";
import { fileTypeFromFile, fileTypeFromBuffer } from "file-type";
import fs from "fs/promises";
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("db connected");
  })
  .catch((error) => {
    console.log(error);
  });

const UserSchema = new mongoose.Schema({
  Email: {
    type: String,
  },
  Name: {
    type: String,
  },
  Username: {
    type: String,
  },
  Pfp: {
    type: String,
  },
  Password: {
    type: String,
  },
  Bio: {
    type: String,
  },
  Followers: {
    type: Number,
  },
  Following: {
    type: Number,
  },

  Liked: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Posts",
    },
  ],

  Joined: {
    type: String,
    default: () => {
      const date = Date.now;
      return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    },
  },
});

const User = mongoose.model("User", UserSchema);

const PostSchema = new mongoose.Schema({
  UserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Url: {
    type: String,
  },
  Caption: {
    type: String,
  },
  Likes: {
    type: Number,
  },
  CommentCount: {
    type: Number,
    default: 0,
  },
  Comments: [
    {
      Commenter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      CommentText: {
        type: String,
        required: true,
      },
      CommentedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  UploadedAt: {
    type: Date,
    default: Date.now,
  },
});
const Posts = mongoose.model("Posts", PostSchema);

app.get("/", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorised Session",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId);

    const feed = await Posts.find();
    feed.reverse();

    const result = [];

    for (let i = 0; i < feed.length; i++) {
      const Owner = await User.findById(feed[i].UserId);

      const post = feed[i].toObject();

      if (Owner) {
        post.Pfp = Owner.Pfp;
        post.Username = Owner.Username;

        post.isLiked = admin.Liked.some(
          (likedPostId) => likedPostId.toString() === post._id.toString(),
        );
      }
      result.push(post);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);

    return res.status(401).json({
      message: "Unauthorised Session",
    });
  }
});

app.post("/signup", async (req, res) => {
  const { Email, Password, Username } = req.body;

  const hashedPassword = await bcrypt.hash(Password, 10);

  try {
    if (!Email || !Password) {
      return res.status(400).json({
        message: "both mail and password required",
      });
    }

    await User.create({
      Email,
      Username,
      Password: hashedPassword,
      Bio: " ",
      Followers: 0,
      Following: 0,
    });

    return res.status(200).json({
      message: "Signed up",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server Error",
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      return res.status(400).json({
        message: "both mail and password needed",
      });
    }

    const user = await User.findOne({
      Email: Email,
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found",
      });
    }

    const MatchedPassword = await bcrypt.compare(Password, user.Password);

    if (!MatchedPassword) {
      return res.status(401).json({
        message: "Incorrect Password",
      });
    }

    const token = await jwt.sign({ userId: user._id }, "userIdKey", {
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
      user: user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

import path from "path";

// const storage = multer.diskStorage({
//   destination: "./uploads",
//   filename: (req, file, cb) =>
//     cb(
//       null,
//       `img${Math.floor(Math.random() * 900000) + 100000}-${Math.floor(Math.random() * 900000) + 100000}-${new Date() * 1}${path.extname(file.originalname)}`,
//     ),
// });
// const upload = multer({
//   storage: storage,
//   fileFilter: (req, file, cb) => {
//     if (["image/jpg", "image/png", "image/jpeg"].includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error("Only png, jpg and jpeg images are allowed"), false);
//     }
//   },
//   limits: {
//     fileSize: 5 * 1024 * 1024, //5mb
//   },
// });
// app.post("/upload", upload.single("image"), async (req, res) => {
//   try {
//     console.log(req.file);
//     const type = await fileTypeFromFile(req.file.path);
//     if (
//       !type ||
//       !["image/jpg", "image/png", "image/jpeg"].includes(type.mime)
//     ) {
//       await fs.unlink(req.file.path);
//       return res.status(400).json({ message: "invalid file type." });
//     }

//     res.status(200).json({ message: "working on it!" });
//   } catch (error) {
//     res.status(500).json({ message: "something went wrong!" });
//     console.log(error);
//   }
// });

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  cloud_name: process.env.CLOUDNAME,
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post("/edit_profile", memoryUpload.single("Pfp"), async (req, res) => {
  try {
    const token = req.cookies.jwt;
    const payload = jwt.verify(token, "userIdKey");

    const { Username, Bio } = req.body;

    const user = await User.findById(payload.userId);

    if (!req.file) {
      return res.status(400).json({
        message: "Could not upload your file!",
      });
    }

    const mimetype = await fileTypeFromBuffer(req.file.buffer);

    const allowedTypes = ["image/png", "image/jpg", "image/jpeg"];

    if (!mimetype || !allowedTypes.includes(mimetype.mime)) {
      return res.status(400).json({
        message: "Only jpg, jpeg and png images are allowed.",
      });
    }

    cloudinary.uploader
      .upload_stream({ resource_type: "image" }, async (err, result) => {
        try {
          if (err) {
            console.log(err);
            return res.status(500).json({
              message: "Cloudinary upload failed",
            });
          }

          console.log(result);

          if (result.secure_url) {
            user.Pfp = result.secure_url;
          }

          if (Username !== undefined && Username.trim() !== "") {
            user.Username = Username.trim();
          }

          if (Bio !== undefined && Bio.trim() !== "") {
            user.Bio = Bio.trim();
          }

          await user.save();

          return res.status(200).json({
            message: "Profile updated",
          });
        } catch (error) {
          console.log(error);

          return res.status(500).json({
            message: "Something went wrong!",
          });
        }
      })
      .end(req.file.buffer);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Something went wrong!",
    });
  }
});
app.post("/uploadmain", memoryUpload.single("image"), async (req, res) => {
  try {
    const token = req.cookies.jwt;
    const { caption } = req.body;

    const payload = jwt.verify(token, "userIdKey");

    const Owner = await User.findById(payload.userId);

    if (!req.file)
      return res.status(400).json({ message: "Could not upload your file!" });

    const mimetype = await fileTypeFromBuffer(req.file.buffer);
    // return console.log(mimetype);
    const allowedTypes = ["image/png", "image/jpg", "image/jpeg"];
    if (!allowedTypes.includes(mimetype.mime))
      return res
        .status(400)
        .json({ message: "Only jpg, jpeg and png images are allowed." });

    cloudinary.uploader
      .upload_stream({ resource_type: "image" }, async (err, result) => {
        if (err) {
          console.log(err);
          throw new Error("");
        }

        console.log(result);

        await Posts.create({
          UserId: payload.userId,
          Url: result.secure_url,
          Likes: 0,
          Shares: 0,
          Caption: caption,
        });
        return res.status(200).json({ message: "Uploaded" });
      })
      .end(req.file.buffer);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong!" });
  }
});

app.get("/profile", async (req, res) => {
  try {
    const token = req.cookies.jwt;
    const payload = jwt.verify(token, "userIdKey");

    const user = await User.findById(payload.userId);

    const UserPosts = await Posts.find({ UserId: payload.userId });

    const result = [];

    for (let i = 0; i < UserPosts.length; i++) {
      const post = UserPosts[i].toObject();

      post.isLiked = user.Liked.some(
        (likedPostId) => likedPostId.toString() === post._id.toString(),
      );

      result.push(post);
    }

    res.status(200).json({ user, UserPosts: result });
  } catch (error) {
    console.log(error);
  }
});

app.get("/post/:id", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorised Session",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const post = await Posts.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    const owner = await User.findById(post.UserId);

    const user = await User.findById(payload.userId);

    const result = post.toObject();

    if (owner) {
      result.Pfp = owner.Pfp;
      result.Username = owner.Username;
      result.Name = owner.Name;
    }

    result.isLiked = user.Liked.some(
      (likedPostId) => likedPostId.toString() === post._id.toString(),
    );

    return res.status(200).json(result);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.post("/likes", async (req, res) => {
  try {
    const token = req.cookies.jwt;
    const payload = jwt.verify(token, "userIdKey");

    const id = req.body.PostId;

    const user = await User.findById(payload.userId);
    const post = await Posts.findById(id);

    if (!user || !post) {
      return res.status(404).json({
        message: "User or post not found",
      });
    }

    const alreadyLiked = user.Liked.some(
      (likedPostId) => likedPostId.toString() === id,
    );

    if (alreadyLiked) {
      post.Likes = Math.max(0, post.Likes - 1);

      user.Liked = user.Liked.filter(
        (likedPostId) => likedPostId.toString() !== id,
      );

      await post.save();
      await user.save();

      return res.status(200).json({
        message: "Post disliked",
        isLiked: false,
        likes: post.Likes,
      });
    }

    post.Likes += 1;
    user.Liked.push(id);

    await post.save();
    await user.save();

    return res.status(200).json({
      message: "Post liked",
      isLiked: true,
      likes: post.Likes,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.post("/addComments", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorised Session",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const CommentTxt = req.body.Comment?.trim();
    const id = req.body.PostId;

    if (!CommentTxt) {
      return res.status(400).json({
        message: "Comment cannot be empty",
      });
    }

    const user = await User.findById(payload.userId);
    const post = await Posts.findById(id);

    if (!user || !post) {
      return res.status(404).json({
        message: "User or post not found",
      });
    }

    post.Comments.push({
      Commenter: payload.userId,
      CommentText: CommentTxt,
      CommentedAt: new Date(),
    });

    post.CommentCount = post.Comments.length;

    await post.save();

    const newComment = post.Comments[post.Comments.length - 1];

    return res.status(200).json({
      id: newComment._id,
      Commenter: user.Username,
      CommenterPfp: user.Pfp,
      Comment: newComment.CommentText,
      CommentedAt: newComment.CommentedAt,
      CommentCount: post.Comments.length,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.get("/getComments/:id", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorised Session",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const post = await Posts.findById(req.params.id);

    const Comments = post.Comments;

    const result = [];

    for (let i = 0; i < Comments.length; i++) {
      const commenter = await User.findById(Comments[i].Commenter);
      result.push({
        id: Comments[i]._id,
        Commenter: commenter.Username,
        CommentText: Comments[i].CommentText,
        CommentedAt: Comments[i].CommentedAt,
        CommenterPfp: commenter.Pfp,
      });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json("server error");
  }
});

app.use((err, req, res, next) => {
  res.status(400).json({ message: err.message });
});

app.listen(1111, () => {
  console.log("http://localhost:1111");
});
