import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  {
    collection: "conversations",
    timestamps: true,
  },
);

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema,
);

export default Conversation;