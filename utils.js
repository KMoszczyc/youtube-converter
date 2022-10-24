const fs = require("fs");
const fsExtra = require("fs-extra");
const ytdl = require("ytdl-core");
const NodeID3 = require("node-id3");
const download = require("image-downloader");
const ffmpeg = require("ffmpeg-static");
const cp = require("child_process");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { default: axios } = require("axios");
const path = require("path");
require("dotenv").config();

String.prototype.replaceAll = function replaceAll(search, replace) {
    return this.split(search).join(replace);
};

const ytdlp_endpoint = "https://yt-dlp-back.herokuapp.com/download"; // Simple Flask app with yt-dlp package (not available in npm) for song downloading.
// const ytdlp_endpoint = "http://localhost:5000/download"

/**
 * Downloads song info from youtube api and parses yt title to author and song titile.
 * Adds thumbnail url.
 * @param {string} url | youtube video url
 * @returns
 */
async function getInfo(url) {
    const usefullPart = url.split("&list=")[0];
    let [_, videoID] = usefullPart.split("?v=");

    // if it's copied link from youtube mobile app
    if (!videoID) videoID = usefullPart.split("youtu.be/")[1];

    console.log("videoID: ", videoID);

    let info = null;
    try {
        info = await ytdl.getBasicInfo(videoID);
    } catch (err) {
        console.log(err);
        return { error: "Video with that url doesn't exist!" };
    }

    // console.log(info.videoDetails);
    let thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 2].url.split("?")[0];
    const fullTitle = info.videoDetails.title;

    console.log(thumbnailUrl);

    let [artist, songTitle] = fullTitle.split(" - ");
    if (songTitle == null) {
        songTitle = artist;
        artist = info.videoDetails.author.name.replace(" - Topic", "");
    }

    // removes parentheses and square brackets
    songTitle = clearText(songTitle);
    let filename = `${artist}-${songTitle}`;
    filename = filename.replaceAll(" ", "_") + ".mp3";

    const sessionID = generateSessionID(32);

    return {
        artist,
        songTitle,
        fullTitle,
        filename,
        thumbnailUrl,
        songUrl: url,
        duration: parseInt(info.videoDetails.lengthSeconds),
        sessionID,
        error: "",
    };
}

/**
 * Removes unnecesary special characters
 * @param {string} text
 * @returns
 */
function clearText(text) {
    const source = typeof text === "string" || text instanceof String ? text : "";
    // return source.replace(/[[/\]{}()*+?.,\\^$|#\"]/g, '');
    // removes parentheses and square brackets and special signs
    return source
        .replace(/ *\([^)]*\) */g, "")
        .replace(/ *\[[^\]]*]/g, "")
        .replace(/[`~!@#$%^&*()_|+\-=?;:",.<>\{\}\[\]\\\/]/gi, "");
}

/**
 * Downloads thumbnail from specified url.
 * @param {Object} info
 * @returns
 */
async function downloadThumbnail(imageDestPath, info) {
    console.log("Thumbnail download started");

    const options = {
        url: info.thumbnailUrl,
        dest: imageDestPath,
    };

    const filenameOB = await download.image(options);
    console.log("Thumbnail downloaded");
    return filenameOB.filename;
}

/**
 * Sets mp3 tags to the song - thumbnail, title, author
 * @param {string} image_path
 * @param {Object} info
 */
function setTags(image_path, info) {
    console.log("Setting tags started");
    const tags = {
        title: info.songTitle,
        artist: info.artist,
        APIC: image_path,
    };

    NodeID3.write(tags, info.songPath, (err) => console.log(err));
    console.log("Setting tags finished");
}

/**
 * Converts .webm song to .mp3 with specified bitrate and start, end time with ffmpeg.
 * @param {Object} info
 * @returns
 */
const convertWebmToMp3 = (info) => {
    return new Promise((resolve, reject) => {
        console.log("FFMPEG conversion started!");
        const ffmpegProcess = cp.spawn(ffmpeg, [
            "-i",
            info.sessionDir + "ytsong.webm",
            "-ss",
            info.start_time,
            "-t",
            info.end_time - info.start_time,
            "-b:a",
            info.bitrate,
            info.songPath,
        ]);

        ffmpegProcess.on("close", () => {
            console.log("FFMPEG conversion done");
            resolve();
        });
    });
};

/**
 * Downloads song from yt-dlp backend, saves it locally in session directory.
 * Then preprocesses the song (conversion, thumbnail download, setting the tags)
 * Sending back all the info with song url to front (which then is accessed and downloaded from the frontend)
 * @param {Object} info
 * @param {*} res
 */
async function downloadSong(info, res) {
    createDir(info.sessionDir);
    console.log(info);

    // ytdl-core version - too slow becouse google sucks :(
    // ytdl(info.songUrl, { quality: "highestaudio" })
    //     .pipe(fs.createWriteStream(info.sessionDir + "ytsong.webm"))
    //     .on("finish", () => {
    //         console.log("Song download finished!");
    //         preprocessSong(info).then((info) => {
    //             console.log("info", info.songPath);
    //             console.log(fs.existsSync(info.songPath));

    //             res.set({
    //                 "Access-Control-Allow-Origin": "*",
    //             });
    //             res.json(info);
    //         });
    //     });

    // yt-dlp version - External Flask API for yt mp3 download
    const request = {
        url: info.songUrl,
        sessionDir: info.sessionDir,
    };

    axios({
        url: ytdlp_endpoint,
        method: "POST",
        responseType: "stream",
        data: request,
    }).then(function (response) {
        console.log("Raw song.webm download started!");
        let stream = fs.createWriteStream(`${info.sessionDir}/ytsong.webm`);
        response.data.pipe(stream);

        stream.on("close", () => {
            console.log("Raw song.webm download finished!");
            preprocessSong(info).then((info) => {
                listDir('/tmp/data')
                listDir(info.sessionDir)

                res.set({
                    "Access-Control-Allow-Origin": "*",
                });
                res.json(info);
            });
        });

        stream.on("error", function (err) {
            console.log(err);
        });
    });
}

/**
 * Converts the song to mp3, adds tags.
 * @param {Object} info
 * @returns
 */
async function preprocessSong(info) {
    await convertWebmToMp3(info);

    const imageDestPath = path.join(info.sessionDir, "thumbnail.jpg");
    await downloadThumbnail(imageDestPath, info);

    setTags(imageDestPath, info);
    console.log(info.songPath);

    return info;
}

/**
 * Generates session directory id, for temporary song storage.
 * @param {int} len
 * @returns
 */
function generateSessionID(len) {
    const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < len; i++) {
        var randomPoz = Math.floor(Math.random() * charSet.length);
        id += charSet.substring(randomPoz, randomPoz + 1);
    }
    return id;
}

/**
 * Creates a directory in specified location if it doesn't exist.
 * @param {string} dir
 */
function createDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function listDir(dir){
    fs.readdirSync(dir).forEach(file => {
        console.log(file);
    });
}

module.exports = {
    downloadSong: downloadSong,
    getInfo: getInfo,
    createDir: createDir
};
