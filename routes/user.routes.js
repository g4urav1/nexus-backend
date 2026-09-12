import express from "express";
import User from "../models/User.js";
import Posts from "../models/Post.js";
import { authenticate } from "../middleware/auth.js";
import cloudinary from "../config/cloudinary.js";
import memoryUpload from "../middleware/upload.js";
import { fileTypeFromBuffer } from "file-type";

const router = express.Router();

router.get("/usernameAvailability", async (req, res) => {
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

router.get("/admin", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

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

router.get("/user/:Username", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

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

router.post(
  "/edit_profile",
  authenticate,
  memoryUpload.single("Pfp"),
  async (req, res) => {
    try {
      const admin = await User.findById(req.userId);

      if (!admin) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const { Username, Bio } = req.body;

      if (Username !== undefined && Username.trim() !== "") {
        admin.Username = Username.trim();
      }

      if (Bio !== undefined && Bio.trim() !== "") {
        admin.Bio = Bio.trim();
      }

      if (req.file) {
        const mimetype = await fileTypeFromBuffer(req.file.buffer);

        const allowedTypes = ["image/png", "image/jpg", "image/jpeg"];

        if (!mimetype || !allowedTypes.includes(mimetype.mime)) {
          return res.status(400).json({
            message: "Only jpg, jpeg and png images are allowed.",
          });
        }

        await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "image" }, async (err, result) => {
              if (err) {
                console.log(err);
                return reject(err);
              }

              if (result?.secure_url) {
                admin.Pfp = result.secure_url;
              }

              resolve();
            })
            .end(req.file.buffer);
        });
      }

      await admin.save();

      return res.status(200).json({
        message: "Profile updated",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Something went wrong!",
      });
    }
  },
);
router.get("/searchUsers", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

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

router.get("/getFollowers/:username", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);
    const username = req.params.username;

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

router.get("/getFollowing/:username", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);
    const username = req.params.username;

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

router.get("/likedPosts/:username", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId).populate("Liked", "Url");

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

export default router;
