import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
    alias: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    location: {
      country: String,
      region: String,
      city: String,
    },
  });

const AnalyticsModel = mongoose.model('Analytics', analyticsSchema);
export default AnalyticsModel;
