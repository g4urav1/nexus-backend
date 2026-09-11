import mongoose from "mongoose";

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

      return `${String(date.getDate()).padStart(2, "0")}/${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}/${date.getFullYear()}`;
    },
  },
});

const User = mongoose.model("User", UserSchema);

export default User;