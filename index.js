const express = require('express')
const path = require('path');

const Utils = require("./utils");

const app = express()
const port = process.env.PORT || 3000

app.use('/data',express.static(path.join(__dirname, 'data')));
app.use(express.static(__dirname+"/public"))

console.log(__dirname)

app.listen(port, () => {
    console.log("Server running on port 3000");
});

// app.get('/', (res, req) => {
//     res.send("<h1>Hello World!</h1>")
// })


app.get('/download', async (req, res) => {
    console.log('endpoint 2')
    await Utils.downloadSong(req.query.url, res)
})

