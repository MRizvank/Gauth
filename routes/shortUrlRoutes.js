import express from "express";
import crypto from "crypto";
import UrlModel from "../models/urlModel.js";
import urlValidator from "../middlewares/urlValidator.js";
import AnalyticsModel from '../models/AnalyticsModel.js'
import requestIp from 'request-ip'
import geoip from 'geoip-lite'
import redisClient from "../auth/redisClient.js";
import { UAParser } from 'ua-parser-js';
 const BASE_URL=process.env.BASE_URL;



const shortUrl = express.Router();
//POST ROUTE TO SHORTEN URL
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
        .send({ shortUrl:`${BASE_URL}/api/shorten/${shortUrl.alias}`});
    
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error Creating short url", error: error.message });
  }
});

//GET ROUTE WITH ANALYTICS
shortUrl.get("/shorten/:alias", async (req, res) => {
  const { alias } = req.params;

  try {
    
    const shortUrlData = await UrlModel.findOne({ alias });

    if (!shortUrlData) {
      return res.status(404).send({ message: "Short URL not found" });
    }

    
    const ip = requestIp.getClientIp(req);
    const geo = geoip.lookup(ip);

    
    const location = {
      country: geo?.country || "Unknown",
      region: geo?.region || "Unknown",
      city: geo?.city || "Unknown",
    };

    
    const existingClick = await AnalyticsModel.findOne({ alias, ipAddress: ip });

   
    if (!existingClick) {
      await UrlModel.updateOne(
        { alias },
        { $inc: { uniqueClicks: 1 } } 
      );
    }

    
    const analyticsData = {
      alias: alias,
      timestamp: new Date(),
      ipAddress: ip || "Unknown IP",
      userAgent: req.headers["user-agent"] || "Unknown User-Agent",
      location: location,
    };

    await AnalyticsModel.create(analyticsData);

   
    res.redirect(shortUrlData.longUrl);

  } catch (error) {
    res.status(500).send({
      message: "Error retrieving short URL",
      error: error.message,
    });
  }
});

//based on analias analytics
shortUrl.get("/analytics/:alias", async (req, res) => {
  const { alias } = req.params;

  try {
    // Fetch all analytics data for the alias
    const analyticsData = await AnalyticsModel.find({ alias });

    if (!analyticsData.length) {
      return res.status(404).json({ message: "No analytics data found." });
    }

   
    const totalClicks = analyticsData.length;

    
    const uniqueUsers = new Set(analyticsData.map(data => data.ipAddress)).size;

   
    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0]; // Format: YYYY-MM-DD
    }).reverse();

    const clicksByDate = last7Days.map(date => {
      const clicks = analyticsData.filter(data =>
        new Date(data.timestamp).toISOString().startsWith(date)
      ).length;

      return { date, clicks };
    });

   
    const osMap = {};
    analyticsData.forEach(data => {
      const parser = new UAParser(data.userAgent);
      const osName = parser.getOS().name || "Unknown";

      if (!osMap[osName]) {
        osMap[osName] = { osName, uniqueClicks: 0, uniqueUsers: new Set() };
      }

      osMap[osName].uniqueClicks += 1;
      osMap[osName].uniqueUsers.add(data.ipAddress);
    });

    const osType = Object.values(osMap).map(os => ({
      osName: os.osName,
      uniqueClicks: os.uniqueClicks,
      uniqueUsers: os.uniqueUsers.size,
    }));

    
    const deviceMap = {};
    analyticsData.forEach(data => {
      const parser = new UAParser(data.userAgent);
      const deviceType = parser.getDevice().type || "desktop"; // Default to desktop

      if (!deviceMap[deviceType]) {
        deviceMap[deviceType] = { deviceName: deviceType, uniqueClicks: 0, uniqueUsers: new Set() };
      }

      deviceMap[deviceType].uniqueClicks += 1;
      deviceMap[deviceType].uniqueUsers.add(data.ipAddress);
    });

    const deviceType = Object.values(deviceMap).map(device => ({
      deviceName: device.deviceName,
      uniqueClicks: device.uniqueClicks,
      uniqueUsers: device.uniqueUsers.size,
    }));

    
    res.status(200).json({
      totalClicks,
      uniqueUsers,
      clicksByDate,
      osType,
      deviceType,
    });

  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//geting topics based analitycs
shortUrl.get("/analytics/topic/:topic", async (req, res) => {
  const { topic } = req.params;

  try {
    const urls = await UrlModel.find({ topic });

    if (!urls.length) {
      return res.status(404).json({ message: "No URLs found for the specified topic." });
    }

    const aliasList = urls.map(url => url.alias);

    const analyticsData = await AnalyticsModel.find({ alias: { $in: aliasList } });

    if (!analyticsData.length) {
      return res.status(404).json({ message: "No analytics data found for the topic." });
    }

 
    const totalClicks = analyticsData.length;
    const uniqueUsers = new Set(analyticsData.map(data => data.ipAddress)).size;


    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0]; // Format: YYYY-MM-DD
    }).reverse();

    const clicksByDate = last7Days.map(date => {
      const clicks = analyticsData.filter(data =>
        new Date(data.timestamp).toISOString().startsWith(date)
      ).length;

      return { date, clicks };
    });

    const urlsAnalytics = urls.map(url => {
      const urlAnalytics = analyticsData.filter(data => data.alias === url.alias);
      const uniqueIPs = new Set(urlAnalytics.map(data => data.ipAddress));

      return {
        shortUrl: `${BASE_URL}/shorten/${url.alias}`, 
        totalClicks: urlAnalytics.length,
        uniqueUsers: uniqueIPs.size
      };
    });

  
    res.status(200).json({
      topic,
      totalClicks,
      uniqueUsers,
      clicksByDate,
      urls: urlsAnalytics,
    });

  } catch (error) {
    console.error("Error fetching topic analytics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//Get Overall Analytics API:
shortUrl.get("/analytics/overall", async (req, res) => {
  const userEmail = req.user.email; // Assuming email is stored in req.user

  try {
   
    const urls = await UrlModel.find({ user_mail: userEmail });

    if (!urls.length) {
      return res.status(404).json({ message: "No URLs found for the user." });
    }

    const aliasList = urls.map(url => url.alias);

    
    const analyticsData = await AnalyticsModel.find({ alias: { $in: aliasList } });

    const totalUrls = urls.length;
    const totalClicks = analyticsData.length;
    const uniqueUsers = new Set(analyticsData.map(data => data.ipAddress)).size;

    
    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0];
    }).reverse();

    const clicksByDate = last7Days.map(date => {
      const clicks = analyticsData.filter(data =>
        new Date(data.timestamp).toISOString().startsWith(date)
      ).length;

      return { date, clicks };
    });

    
    const osMap = {};
    analyticsData.forEach(data => {
      const parser = new UAParser(data.userAgent);
      const osName = parser.getOS().name || "Unknown";

      if (!osMap[osName]) {
        osMap[osName] = { osName, uniqueClicks: 0, uniqueUsers: new Set() };
      }

      osMap[osName].uniqueClicks += 1;
      osMap[osName].uniqueUsers.add(data.ipAddress);
    });

    const osType = Object.values(osMap).map(os => ({
      osName: os.osName,
      uniqueClicks: os.uniqueClicks,
      uniqueUsers: os.uniqueUsers.size,
    }));

   
    const deviceMap = {};
    analyticsData.forEach(data => {
      const parser = new UAParser(data.userAgent);
      const deviceType = parser.getDevice().type || "desktop"; // Default to desktop

      if (!deviceMap[deviceType]) {
        deviceMap[deviceType] = { deviceName: deviceType, uniqueClicks: 0, uniqueUsers: new Set() };
      }

      deviceMap[deviceType].uniqueClicks += 1;
      deviceMap[deviceType].uniqueUsers.add(data.ipAddress);
    });

    const deviceType = Object.values(deviceMap).map(device => ({
      deviceName: device.deviceName,
      uniqueClicks: device.uniqueClicks,
      uniqueUsers: device.uniqueUsers.size,
    }));

    
    res.status(200).json({
      totalUrls,
      totalClicks,
      uniqueUsers,
      clicksByDate,
      osType,
      deviceType,
    });

  } catch (error) {
    console.error("Error fetching overall analytics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//personal add on 
shortUrl.get("/user-urls", async (req, res) => {
  const { email } = req.query;
  try {
    const urls = await UrlModel.find({ user_mail: email });
    const response = urls.map(url => ({
      shortUrl: `${BASE_URL}/api/shorten/${url.alias}`,
      clicks: url.uniqueClicks || 0, // Assuming clicks are stored
    }));
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: "Error fetching URLs", error: error.message });
  }
});



export default shortUrl;
