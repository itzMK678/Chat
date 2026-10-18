import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  type: {
    type: String,
    enum: ["text", "voice"],
    default: "text",
  },
  audioUrl: {
    type: String,
    default: "",
  },
});

const Message = mongoose.model("Message", messageSchema);
export default Message;
