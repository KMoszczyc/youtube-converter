const fs = require("fs");
const fsExtra = require("fs-extra");
const ytdl = require("ytdl-core");
const NodeID3 = require("node-id3").Promise;
const download = require("image-downloader");
const ffmpeg = require("ffmpeg-static");
const cp = require("child_process");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { default: axios } = require("axios");
const path = require("path");
require("dotenv").config();

// Temporarly storing mp3 files in AWS S3 bucket - Comment out those lines if you'are not using Cyclic.sh
const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const BUCKET_NAME = "cyclic-cloudy-pig-trench-coat-eu-central-1";
const CyclicDb = require("@cyclic.sh/dynamodb")
const db = CyclicDb("cloudy-pig-trench-coatCyclicDB")
const stats_collection = db.collection("stats")

String.prototype.replaceAll = function replaceAll(search, replace) {
    return this.split(search).join(replace);
};

// Simple Flask app with yt-dlp package (not available in npm) for song downloading.
// const ytdlp_endpoint = "https://yt-dlp-back.herokuapp.com/download";
const ytdlp_endpoint = "https://yt-dlp-back.onrender.com/download"
// const ytdlp_endpoint = "http://localhost:5000/download"



// Init stats
// stats_collection.delete('stats')
// stats_collection.set('stats', {
//     totalSeconds: 0,
//     totalConversions: 0,
//     totalVisits: 0,
// })

async function updateVisitStats(){
    let stats = await getStats()

    await stats_collection.set('stats', {
        totalVisits: stats.totalVisits + 1,
    })

    let statsUpdated = await getStats()
    return statsUpdated;
}

async function updateStats(info){
    let stats = await getStats()
    let totalSeconds = stats.totalSeconds + parseInt(info.duration)
    let totalConversions = stats.totalConversions + 1

    stats_collection.set('stats', {
        totalSeconds: totalSeconds,
        totalConversions: totalConversions,
    })

    console.log(stats)
    console.log('Updated stats:',totalSeconds, totalConversions)
}   

async function getStats(){
    let stats = await stats_collection.get("stats")
    return stats.props
}

/**
 * Downloads song info from youtube api and parses yt title to author and song titile.
 * Adds thumbnail url.
 * @param {string} url | youtube video url
 * @returns
 */
async function getInfo(url) {
    let decodedUrl = decodeURIComponent(url);
    let videoID = null;
    let info = null;

    try {
        // if url contains 'youtube.be' its from youtube mobile app, otherwise its from pc
        //Mobile
        if (decodedUrl.includes("youtu.be/")) 
            videoID = decodedUrl.split("youtu.be/")[1];
        //PC
        else 
            videoID = decodedUrl.split("?v=")[1].split("&")[0];

        console.log("videoID: ", videoID);
        info = await ytdl.getInfo(videoID);
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
        songUrl: decodedUrl,
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
async function setTags(image_path, info) {
    console.log("Setting tags started");
    const tags = {
        title: info.songTitle,
        artist: info.artist,
        APIC: image_path,
    };

    await NodeID3.write(tags, info.songPath, (err) => console.log(err));
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
        console.log(path.join(info.fullSessionDirPath, "ytsong.webm"));
        console.log(info.songPath);
        listDir(info.fullSessionDirPath);

        const ffmpegProcess = cp.spawn(ffmpeg, [
            "-i",
            path.join(info.fullSessionDirPath, "ytsong.webm"),
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
    createDir(info.fullSessionDirPath);
    console.log(info);

    // ytdl-core version - too slow becouse google sucks :(
    // ytdl(info.songUrl, { quality: "highestaudio" })
    //     .pipe(fs.createWriteStream(info.fullSessionDirPath + "ytsong.webm"))
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
        sessionDir: info.fullSessionDirPath,
    };

    const ytDlpResponse = await axios({
        url: ytdlp_endpoint,
        method: "POST",
        responseType: "stream",
        data: request,
    });

    console.log("Raw song.webm download started!");
    let stream = fs.createWriteStream(path.join(info.fullSessionDirPath, "ytsong.webm"));
    ytDlpResponse.data.pipe(stream);

    await new Promise(function (resolve, reject) {
        stream.on("close", () => resolve(console.log("Raw song.webm download finished!")));
        stream.on("error", (err) => console.log(err));
    });

    info = await preprocessSong(info);

    // Uncomment if you want to use something else than Cyclic.sh
    // const presignedUrl = info['endpointSongPath']

    // Comments those lines if you'are not using Cyclic.sh and AWS S3 Bucket
    console.log("Upload mp3 to S3 Bucket");
    const dstS3SongPath = info["endpointSongPath"].replaceAll("\\", "/");
    await uploadSongToS3Bucket(info["songPath"], dstS3SongPath);
    console.log("Pre-sign mp3 url");
    const presignedUrl = await getSignedUrlForDownload(dstS3SongPath);

    // Update statistic values like total downloads or seconds
    await updateStats(info)

    res.set({
        "Access-Control-Allow-Origin": "*",
    });
    res.json({ url: presignedUrl });
}

/**
 * Converts the song to mp3, adds tags.
 * @param {Object} info
 * @returns
 */
async function preprocessSong(info) {
    await convertWebmToMp3(info);

    const imageDestPath = path.join(info.fullSessionDirPath, "thumbnail.jpg");
    await downloadThumbnail(imageDestPath, info);

    await setTags(imageDestPath, info);
    console.log(info.songPath);

    return info;
}

async function uploadSongToS3Bucket(srcSongPath, dstS3SongPath) {
    const data = fs.readFileSync(srcSongPath);

    const params = {
        Bucket: BUCKET_NAME,
        Key: dstS3SongPath,
        Body: data,
        ContentType: "audio/mpeg",
    };

    await s3
        .upload(params, function (err, data) {
            if (err) throw err;
            console.log(`File uploaded successfully at ${data.Location}`);
        })
        .promise();
}

async function getSignedUrlForDownload(songS3Path) {
    const params = {
        Bucket: BUCKET_NAME,
        Key: songS3Path,
        Expires: 180,
    };

    const url = await new Promise((resolve, reject) => {
        s3.getSignedUrl("getObject", params, (err, url) => {
            if (err) reject(err);

            resolve(url);
        });
    });

    return url;
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

function listDir(dir) {
    if (!fs.existsSync(dir)) {
        console.log(dir, "doesnt exist!");
    }

    fs.readdirSync(dir).forEach((file) => {
        console.log(file);
    });
}

async function getBucketKeys(params = { Bucket: BUCKET_NAME }, allKeys = []) {
    const response = await s3.listObjectsV2(params).promise();
    response.Contents.forEach((obj) => allKeys.push(obj.Key));

    if (response.NextContinuationToken) {
        params.ContinuationToken = response.NextContinuationToken;
        await getBucketKeys(params, allKeys); // RECURSIVE CALL
    }
    return allKeys;
}

async function clearBucket(bucket = BUCKET_NAME, dir = "") {
    const listParams = {
        Bucket: bucket,
        Prefix: dir,
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    // Cyclic puts 2 objects by default in the bucket
    if (listedObjects.Contents.length <= 2) return [];

    const deleteParams = {
        Bucket: BUCKET_NAME,
        Delete: { Objects: [] },
    };

    listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
    });

    await s3.deleteObjects(deleteParams).promise();

    if (listedObjects.IsTruncated) await clearBucket(bucket, dir);

    return deleteParams.Delete.Objects;
}

function decodeUrlsInObject(info) {
    Object.keys(info).forEach((key, value) => {
        info[key] = decodeURIComponent(info[key]);
    });

    return info;
}

module.exports = {
    downloadSong: downloadSong,
    getInfo: getInfo,
    createDir: createDir,
    getBucketKeys: getBucketKeys,
    clearBucket: clearBucket,
    getSignedUrlForDownload: getSignedUrlForDownload,
    decodeUrlsInObject: decodeUrlsInObject,
    getStats: getStats,
    updateVisitStats: updateVisitStats
};
