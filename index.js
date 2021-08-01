const express = require('express')
const fs = require('fs');
const path = require('path');
const mime = require('mime');

const Utils = require("./utils");

const app = express()
app.use(express.static('data'));
app.use(express.static(__dirname));

app.listen(3000, () => {
    console.log("Server running on port 3000");
});

app.get('/download', async (req, res) => {
    console.log('endpoint 2')
    await Utils.downloadSong(req.query.url, res)
})

