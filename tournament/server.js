const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname)); // serve HTML and other files

app.post('/save', (req, res) => {
  const taskData = JSON.stringify(req.body) + '\n';
  fs.appendFile('tasks.txt', taskData, err => {
    if (err) {
      console.error('Failed to write:', err);
      return res.status(500).send('Error saving task');
    }
    res.send('Task saved');
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
