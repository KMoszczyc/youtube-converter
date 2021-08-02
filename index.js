const express = require('express')
const fs = require('fs');
const path = require('path');
const mime = require('mime');

const Utils = require("./utils");

const app = express()
const port = process.env.PORT || 3000

app.use(express.static('data'));
app.use(express.static("public"))
app.use(express.static(__dirname));

app.listen(port, () => {
    console.log("Server running on port 3000");
});

app.get('/', (res, req) => {
    res.send("<h1>Hello World!</h1>")
})


app.get('/download', async (req, res) => {
    console.log('endpoint 2')
    await Utils.downloadSong(req.query.url, res)
})

