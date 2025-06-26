import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  name: { type: String, required: true },
  data: { type: Object, required: true },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed'],
    default: 'active',
  },
  result: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  failedAt: { type: Date },
});

export default mongoose.model('Job', jobSchema);