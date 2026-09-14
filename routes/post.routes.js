import express from "express";
import { fileTypeFromBuffer } from "file-type";

import User from "../models/User.js";
import Posts from "../models/Post.js";

import cloudinary from "../config/cloudinary.js";
import memoryUpload from "../middleware/upload.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

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

router.post(
  "/uploadmain",
  authenticate,
  memoryUpload.single("image"),
  async (req, res) => {
    try {
      const admin = await User.findById(req.userId);
      const { caption } = req.body;

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
            UserId: req.userId,
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
  },
);

router.get("/post/:id", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

    const post = await Posts.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    const owner = await User.findById(post.UserId);

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

router.post("/likes", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

    const id = req.body.PostId;
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

router.post("/addComments", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

    const CommentTxt = req.body.Comment?.trim();
    const id = req.body.PostId;

    if (!CommentTxt) {
      return res.status(400).json({
        message: "Comment cannot be empty",
      });
    }

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
      Commenter: req.userId,
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

router.get("/getComments/:id", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

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

export default router;
