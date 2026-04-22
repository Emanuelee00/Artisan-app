import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  chatId:    { type: String, required: true, index: true },
  senderId:  { type: String, required: true },
  text:      String,
  imageUrl:  String,
  type:      { type: String, enum: ['text', 'image', 'invoice'], default: 'text' },
  readAt:    Date,
}, { timestamps: true })

export const MessageModel = mongoose.model('Message', messageSchema)
