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
    Caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    Receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    collection: "conversations",
    timestamps: true,
  },
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
