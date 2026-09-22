import express from "express";
import User from "../models/User.js";
import Posts from "../models/Post.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/follow", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

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

    // FOLLOW
    admin.Following.push(profileUser._id);
    admin.FollowingCount += 1;

    profileUser.Followers.push(admin._id);
    profileUser.FollowersCount += 1;

    await admin.save();
    await profileUser.save();

    await User.findByIdAndUpdate(profileUser._id, {
      $push: {
        Notifications: {
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

router.get("/notifications", authenticate, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);

    if (!admin) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const result = [];

    for (let i = 0; i < admin.Notifications.length; i++) {
      const by = await User.findById(admin.Notifications[i].by);

      const post = admin.Notifications[i].postId
        ? await Posts.findById(admin.Notifications[i].postId)
        : null;

      result.push({
        id: admin.Notifications[i]._id,
        NotificationBy: by ? by.Username : null,
        NotificationMessage: admin.Notifications[i].message,
        sentAt: admin.Notifications[i].sentAt,
        byPfp: by ? by.Pfp : null,
        postUrl: post ? post.Url : null,
      });
    }

    return res.status(200).json(result.reverse());
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "something went wrong",
    });
  }
});

router.get("/conversations", authenticate, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId,
    }).populate("participants", "Username Pfp");

    const result = conversations.map((conversation) => {
      const otherUsers = conversation.participants.filter(
        (user) => user._id.toString() !== req.userId.toString(),
      );

      return {
        conversationId: conversation._id,
        participants: otherUsers.map((user) => ({
          pfp: user.Pfp || "",
          Username: user.Username || "Unknown User",
        })),
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to fetch conversations",
    });
  }
});

router.get("/messages/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversation_id: conversationId,
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch messages",
    });
  }
});


router.post("/sendMessages/:conversationId", authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    const io = req.app.get("io");

    const message = await Message.create({
      user_id: req.userId,
      content: content,
      conversation_id: conversationId,
      created_at: Date.now(),
    });

    io.emit("RefreshMsg", "Getting Messages");

    return res.status(200).json({
      message: "sent",
      data: message,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Failed to send message",
    });
  }
});

export default router;
