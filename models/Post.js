import mongoose from "mongoose";

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

export default Posts;
