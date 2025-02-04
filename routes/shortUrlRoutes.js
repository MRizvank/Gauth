import express from "express";
import crypto from "crypto";
import UrlModel from "../models/urlModel.js";
import urlValidator from "../middlewares/urlValidator.js";

const shortUrl = express.Router();

shortUrl.post("/shorten", urlValidator, async (req, res) => {
  const { longUrl, topic } = req.body;
  try {
    
      const uniqueStrings = new Set();
      const generateUniqueString = () => {
        let str;
        do {
          str = crypto
            .randomBytes(4)
            .toString("base64")
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 6);
        } while (uniqueStrings.has(str)); // Ensure it's unique

        uniqueStrings.add(str);
        return str;
      };

      const service = {
        longUrl,
        alias: generateUniqueString(),
        topic: topic ? topic : "",
        user_mail: req.user.emails[0].value,
      };
      const shortUrl = await UrlModel.create(service);
     
      res
        .status(201)
        .send({ shortUrl:`http://localhost:3000/api/shorten/${shortUrl.alias}`});
    
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error Creating short url", error: error.message });
  }
});

// GET Route to Find Data by Alias
shortUrl.get("/shorten/:alias", async (req, res) => {
  const { alias } = req.params; // Get the alias from the URL

  try {
    // Find the URL in the database using the alias
    const shortUrlData = await UrlModel.findOne({ alias });

    if (!shortUrlData) {
      return res.status(404).send({ message: "Short URL not found" });
    }

    res.redirect(shortUrlData.longUrl);
  } catch (error) {
    res.status(500).send({
      message: "Error retrieving short URL",
      error: error.message,
    });
  }
});




export default shortUrl;
