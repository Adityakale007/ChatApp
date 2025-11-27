const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  room: { type: String, required: true },
  user: { type: String, required: true },
  text: { type: String, default: "" },
  ts: { type: Number, required: true },

  // NEW: message type & file metadata
  messageType: {
    type: String,
    enum: ["text", "file"],
    default: "text"
  },
  fileUrl: String,
  fileName: String,
  fileSize: Number,
  fileType: String
});

module.exports = mongoose.model("Message", messageSchema);
