import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "messages",
  },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;