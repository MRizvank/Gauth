import mongoose from "mongoose";

const urlSchema = mongoose.Schema(
  {
    longUrl: { type: String, required: true },
    alias: { type: String, required: true, unique: true },
    topic: { type: String},
    user_mail:{type :String,required:true}
  },
  { 
    timestamps: true, 
    versionKey: false
  }
);


 const UrlModel = mongoose.model("urls", urlSchema);
 export default UrlModel;
