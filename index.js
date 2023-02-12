const express = require("express");
const path = require("path");
const fs = require("fs");
const ytdl = require("ytdl-core");
const os = require("os");
const Utils = require("./src/utils");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 4000;

const dataPath = path.join(os.tmpdir(), "data");
// const dataPath = path.join(__dirname, "data");

Utils.createDir(dataPath);

app.use("/data", express.static(dataPath));
app.use(express.static(__dirname + "/public"));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

/**
 * Downloads and converts song with selected bitrate.
 * Every download request creates session directory that gets deleted after a minute.
 */
app.get("/download", async (req, res) => {
    console.log("download started");

    const sessionDir = path.join("data", req.query.sessionID);
    const fullSessionDirPath = path.join(dataPath, req.query.sessionID);
    setTimeout(() => {
        fs.rmSync(sessionDir, { recursive: true });
    }, 180 * 1000);

    let info = Utils.decodeUrlsInObject(req.query);
    info["endpointSongPath"] = path.join(sessionDir, info.filename);
    info["songPath"] = path.join(fullSessionDirPath, info.filename);
    info["fullSessionDirPath"] = fullSessionDirPath;

    await Utils.downloadSong(info, res);
});

/**
 * Downloads song info and sends it back to front (thumbnail image, author, song titile).
 * Parses youtube title to author and song title.
 */
app.get("/getInfo", async (req, res) => {
    const info = await Utils.getInfo(req.query.url);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(info);
});

app.get("/clearBucket", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    if(req.headers.clear_bucket_password != process.env.CLEAR_BUCKET_PASSWORD){
        res.json({error: `Wrong password: ${req.headers.clear_bucket_password}`});
        return
    }

    const keys = await Utils.clearBucket()
    console.log('Deleted files:', keys)

    res.json({'Deleted files': keys});
});

app.get("/bucketItem", async (req, res) => {
    const urls = await Utils.getSignedUrlForDownload(req.query.itemBucketPath);
    console.log(urls)

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({url: signedUrl});
})

app.get("/getStats", async (req, res) => {
    const stats = await Utils.getStats();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(stats);
});

app.get("/updateVisitStats", async (req, res) => {
    const stats = await Utils.updateVisitStats();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(stats);
});
