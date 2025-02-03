import {isUrl} from 'check-valid-url'


  const   urlValidator = (req, res, next) => {
    const { longUrl } = req.body;
    
    if (isUrl(longUrl)) {
        next(); 
    } else {
        return res.status(400).json({ error: "Please provide a valid URL." });
    }
};

export default urlValidator;



  
  
