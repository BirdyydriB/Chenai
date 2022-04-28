const appRoutes = require('./src/routes.js');
const express = require('express');
const app = express();

app.listen(3000, function() {
  console.log('app listening on port 3000 (' + process.env.NODE_ENV + ')');
});

// Remove timeout for requests
app.use(function(req, res, next) {
  res.setTimeout(0, function() {
    console.log('timeout');
  });
  next();
});

// Build all routes
appRoutes.initRoutes(app);
