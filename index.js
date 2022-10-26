const express = require("express");
const path = require("path");
const fs = require("fs");
const ytdl = require("ytdl-core");
const os = require("os");
const Utils = require("./utils");

const app = express();
const port = process.env.PORT || 3000;

const dataPath = path.join(os.tmpdir(), "data");
// const dataPath = path.join(__dirname, "data");

Utils.createDir(dataPath);

app.use("/data", express.static(dataPath));
app.use(express.static(__dirname + "/public"));

app.listen(port, () => {
    console.log("Server running on port 3000");
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

    let info = req.query;
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
