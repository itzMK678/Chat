const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String },
    createdAt: { type: Date, default: Date.now },
    type: {
  type: String,
  enum: ["text", "voice"],
  default: "text"
},
audioUrl: {
  type: String,
  default: ""
}
});

module.exports = mongoose.model("Message", messageSchema);
