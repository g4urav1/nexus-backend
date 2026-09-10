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
    console.log("MongoDB connected:", mongoose.connection.name);
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

const sender = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
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
  Code: {
    type: Number,
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
  FollowersCount: {
    type: Number,
    default: 0,
  },
  FollowingCount: {
    type: Number,
  },

  Notifications: [
    {
      type: Object,
      message: String,
      sentAt: {
        type: Date,
        default: Date.now,
      },
      by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Posts",
      },
    },
  ],

  Followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  Following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  Liked: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Posts",
    },
  ],

  Joined: {
    type: String,
    default: () => {
      const date = new Date();
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

app.get("/usernameAvailability", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        message: "Username is required",
      });
    }

    const existingUser = await User.findOne({
      Username: username,
    });

    return res.status(200).json({
      isAvailable: !existingUser,
    });
  } catch (error) {
    console.error("Username availability error:", error);

    return res.status(500).json({
      message: "Server Error",
    });
  }
});

app.post("/signup", async (req, res) => {
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

app.post("/login", async (req, res) => {
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
import { type } from "os";

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

    const admin = await User.findById(payload.userId);

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
            admin.Pfp = result.secure_url;
          }

          if (Username !== undefined && Username.trim() !== "") {
            admin.Username = Username.trim();
          }

          if (Bio !== undefined && Bio.trim() !== "") {
            admin.Bio = Bio.trim();
          }

          await admin.save();

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

app.get("/admin", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "No JWT found",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId);

    if (!admin) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const userPosts = await Posts.find({
      UserId: admin._id,
    });

    const result = userPosts.map((post) => {
      const postObject = post.toObject();

      postObject.isLiked =
        admin.Liked?.some(
          (likedPostId) => likedPostId.toString() === postObject._id.toString(),
        ) ?? false;

      return postObject;
    });

    return res.status(200).json({
      admin: { ...admin.toObject(), Password: undefined },
      UserPosts: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      message: "Invalid or expired JWT",
    });
  }
});

app.get("/user/:Username", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "No JWT found",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId);

    if (!admin) {
      return res.status(401).json({
        message: "Authenticated user not found",
      });
    }

    const profileUser = await User.findOne({
      Username: req.params.Username,
    });

    if (!profileUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const userPosts = await Posts.find({
      UserId: profileUser._id,
    });

    const isFollowing =
      admin.Following?.some(
        (followingUserId) =>
          followingUserId.toString() === profileUser._id.toString(),
      ) ?? false;

    const postresult = userPosts.map((post) => {
      const postObject = post.toObject();

      postObject.isLiked =
        admin.Liked?.some(
          (likedPostId) => likedPostId.toString() === postObject._id.toString(),
        ) ?? false;

      return postObject;
    });

    return res.status(200).json({
      user: {
        ...profileUser.toObject(),
        Password: undefined,
      },
      isFollowing,
      UserPosts: postresult,
    });
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      message: "Invalid or expired JWT",
    });
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

    const admin = await User.findById(payload.userId);

    const result = post.toObject();

    if (owner) {
      result.Pfp = owner.Pfp;
      result.Username = owner.Username;
      result.Name = owner.Name;
    }

    result.isLiked = admin.Liked.some(
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

    const admin = await User.findById(payload.userId);
    const post = await Posts.findById(id);

    if (!admin || !post) {
      return res.status(404).json({
        message: "User or post not found",
      });
    }

    const owner = await User.findById(post.UserId);

    if (!owner) {
      return res.status(404).json({
        message: "Post owner not found",
      });
    }

    const alreadyLiked = admin.Liked.some(
      (likedPostId) => likedPostId.toString() === id,
    );

    if (alreadyLiked) {
      post.Likes = Math.max(0, post.Likes - 1);

      admin.Liked = admin.Liked.filter(
        (likedPostId) => likedPostId.toString() !== id,
      );

      await post.save();
      await admin.save();

      await User.findByIdAndUpdate(owner._id, {
        $pull: {
          Notifications: {
            type: "like",
            postId: post._id,
          },
        },
      });

      return res.status(200).json({
        message: "Post disliked",
        isLiked: false,
        likes: post.Likes,
      });
    }

    post.Likes += 1;
    admin.Liked.push(id);

    await post.save();
    await admin.save();

    await User.findByIdAndUpdate(owner._id, {
      $push: {
        Notifications: {
          type: "like",
          message: "liked your post.",
          sentAt: new Date(),
          by: admin._id,
          postId: post._id,
        },
      },
    });

    return res.status(200).json({
      message: "Post liked",
      isLiked: true,
      likes: post.Likes,
    });
  } catch (error) {
    console.error(error);

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

    const admin = await User.findById(payload.userId);
    const post = await Posts.findById(id);
    const owner = await User.findById(post.UserId);

    if (!admin || !post) {
      return res.status(404).json({
        message: "User or post not found",
      });
    }

    if (!owner) {
      return res.status(404).json({
        message: "Post owner not found",
      });
    }

    post.Comments.push({
      Commenter: payload.userId,
      CommentText: CommentTxt,
      CommentedAt: new Date(),
    });

    post.CommentCount = post.Comments.length;

    await post.save();

    await User.findByIdAndUpdate(owner._id, {
      $push: {
        Notifications: {
          type: "comment",
          message: `commented "${CommentTxt}" on your post.`,
          sentAt: new Date(),
          by: admin._id,
          postId: post._id,
        },
      },
    });

    const newComment = post.Comments[post.Comments.length - 1];

    return res.status(200).json({
      id: newComment._id,
      Commenter: admin.Username,
      CommenterPfp: admin.Pfp,
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
    return res.status(200).json(result.reverse());
  } catch (error) {
    console.log(error);
    res.status(500).json("server error");
  }
});

app.get("/searchUsers", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "No JWT found",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId);

    if (!admin) {
      return res.status(401).json({
        message: "Authenticated user not found",
      });
    }

    const { searchQuery } = req.query;

    const people = await User.find({
      Username: {
        $regex: searchQuery,
        $options: "i",
      },
    })
      .select("-Password")
      .limit(20);

    const peopleObj = people.map((person) => person.toObject());

    const isFollowing = peopleObj.map((person) => ({
      ...person,
      isFollowing: admin.Following.some(
        (followingId) => followingId.toString() === person._id.toString(),
      ),
    }));

    return res.status(200).json(isFollowing);
  } catch (err) {
    console.error("Search users error:", err);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.get("/notifications", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorised Session",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId);

    if (!admin) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const result = [];

    for (let i = 0; i < admin.Notifications.length; i++) {
      const by = await User.findById(admin.Notifications[i].by);
      const post = await Posts.findById(admin.Notifications[i].postId);
      result.push({
        id: admin.Notifications[i]._id,
        NotificationBy: by.Username,
        NotificationMessage: admin.Notifications[i].message,
        sentAt: admin.Notifications[i].sentAt,
        byPfp: by.Pfp,
        postUrl: post ? post.Url : null,
      });
    }

    return res.status(200).json(result.reverse());
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong");
  }
});

app.post("/follow", async (req, res) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const payload = jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId);
    const id = req.body.UserId;
    const profileUser = await User.findById(id);

    if (!admin) {
      return res.status(404).json({
        message: "Logged-in user not found",
      });
    }

    if (!profileUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const alreadyFollowed = admin.Following.some(
      (followingUserId) =>
        followingUserId.toString() === profileUser._id.toString(),
    );
    if (alreadyFollowed) {
      admin.Following = admin.Following.filter(
        (followingUserId) =>
          followingUserId.toString() !== profileUser._id.toString(),
      );

      admin.FollowingCount = Math.max(0, admin.FollowingCount - 1);

      profileUser.Followers = profileUser.Followers.filter(
        (followerId) => followerId.toString() !== admin._id.toString(),
      );

      profileUser.FollowersCount = Math.max(0, profileUser.FollowersCount - 1);

      await admin.save();
      await profileUser.save();

      await User.findByIdAndUpdate(profileUser._id, {
        $pull: {
          Notifications: {
            type: "Follow",
            by: admin._id,
          },
        },
      });

      console.log("UNFOLLOWED");

      return res.status(200).json({
        message: "User UnFollowed",
        isFollowing: false,
        Followers: profileUser.Followers,
        FollowersCount: profileUser.FollowersCount,
      });
    }

    admin.Following.push(profileUser._id);
    admin.FollowingCount += 1;

    profileUser.Followers.push(admin._id);
    profileUser.FollowersCount += 1;

    await admin.save();
    await profileUser.save();

    await User.findByIdAndUpdate(profileUser._id, {
      $push: {
        Notifications: {
          type: "Follow",
          message: "Followed You.",
          sentAt: new Date(),
          by: admin._id,
        },
      },
    });

    console.log("FOLLOWED");

    return res.status(200).json({
      message: "User Followed",
      isFollowing: true,
      Followers: profileUser.Followers,
      FollowersCount: profileUser.FollowersCount,
    });
  } catch (error) {
    console.error("FOLLOW ERROR:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.get("/getFollowers/:username", async (req, res) => {
  try {
    const token = req.cookies.jwt;
    const username = req.params.username;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorised Session",
      });
    }

    const payload = await jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId);

    const user = await User.findOne({ Username: username }).populate(
      "Followers",
      "Username Pfp",
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const result = user.Followers.map((follower) => ({
      id: follower._id,
      Follower: follower.Username,
      FollowerPfp: follower.Pfp,
      isFollowing: admin.Following.some(
        (followingUserId) =>
          followingUserId.toString() === follower._id.toString(),
      ),
    }));

    return res.status(200).json({
      result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.get("/getFollowing/:username", async (req, res) => {
  try {
    const token = req.cookies.jwt;
    const username = req.params.username;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorised Session",
      });
    }

    const payload = await jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId);

    const user = await User.findOne({ Username: username }).populate(
      "Following",
      "Username Pfp isFollowing",
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const result = user.Following.map((following) => ({
      id: following._id,
      Following: following.Username,
      FollowingPfp: following.Pfp,
      isFollowing: admin.Following.some(
        (followingUserId) =>
          followingUserId.toString() === following._id.toString(),
      ),
    }));

    console.log(result);

    return res.status(200).json({
      result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.get("/likedPosts/:username", async (req, res) => {
  try {
    const token = req.cookies.jwt;
    const username = req.params.username;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorised Session",
      });
    }

    const payload = await jwt.verify(token, "userIdKey");

    const admin = await User.findById(payload.userId).populate("Liked", "Url");

    if (!admin) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const result = admin.Liked.map((likedPost) => ({
      id: likedPost._id,
      url: likedPost.Url,
    }));

    return res.status(200).json({
      result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.post("/getCode", async (req, res) => {
  try {
    const { UserName } = req.body;

    const user = await User.findOne({ Username: UserName });

    if (!user) {
      return res.status(401).json({ message: "No user found" });
    }

    const Code = Math.floor(Math.random() * 900000 + 100000);

    user.Code = Code;
    await user.save();

    const template = `
    Hi ${UserName},

We received a request to reset the password for your Nexus account.

Use the verification code below to continue:

${Code}


If you didn't request a password reset, you can safely ignore this email. Your account and password will remain unchanged.

Need help? Contact the support team.


Connect. Share. Inspire.
Your social space for discovering creators and connecting with friends.

© 2026 . All rights reserved.
`;

    await sender.sendMail({
      from: `"nexus" <${process.env.MAIL_USER}>`,
      to: user.Email,
      subject: "password reset code",
      html: template,
    });

  return res.status(200).json({
      message: "check mail for code",
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "something went wrong" });
  }
});

app.use((err, req, res, next) => {
  res.status(400).json({ message: err.message });
});

app.listen(1111, () => {
  console.log("http://localhost:1111");
});
