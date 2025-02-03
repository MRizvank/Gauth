import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// export const PORT = process.env.PORT || 8000 ;

 const connection = async () => {
  try {
    
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log({ msg: "cannot connect to db", error: error.message });
    process.exit(1);
  }
};

export default connection;


