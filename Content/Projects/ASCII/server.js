const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  console.log(`Serving index.html for ${req.url}`);
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`ASCII Zen Garden listening at http://localhost:${port}`);
  console.log(`Current directory: ${__dirname}`);
});
