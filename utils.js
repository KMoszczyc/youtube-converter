const fs = require('fs');
const fsExtra = require('fs-extra')
const ytdl = require('ytdl-core');
const NodeID3 = require('node-id3')
const download = require('image-downloader')
const ffmpeg = require('ffmpeg-static');
const cp = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { default: axios } = require('axios');

String.prototype.replaceAll = function replaceAll(search, replace) { return this.split(search).join(replace); }

const ytdlp_endpoint = 'https://yt-dlp-back.herokuapp.com/download'

async function getInfo(url){
    const usefullPart = url.split('&list=')[0]
    let [_, videoID] = usefullPart.split('?v=')

    // if it's copied link from youtube mobile app
    if(!videoID)
        videoID = usefullPart.split('youtu.be/')[1]

    console.log('videoID: ', videoID)

    let info = null
    try {
        info = await ytdl.getBasicInfo(videoID);
    }
    catch(err){
        console.log(err)
        return {error: "Video with that url doesn't exist!"}
    }

    // console.log(info.videoDetails);
    let thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 2].url.split('?')[0];
    const fullTitle =  info.videoDetails.title;

    console.log(thumbnailUrl)

    let [artist, songTitle] = fullTitle.split(' - ')
    if (songTitle == null){
        songTitle = artist
        artist = info.videoDetails.author.name.replace(' - Topic', '');
    }

    // removes parentheses and square brackets
    songTitle = songTitle.replace(/ *\([^)]*\) */g, "").replace(/ *\[[^\]]*]/g, '');;
    let filename =`${artist}-${songTitle}`
    filename =  clearText(filename).replaceAll(' ', '_') + '.mp3'

    const sessionID = generateSessionID(32)

    return {artist, songTitle, fullTitle, filename, thumbnailUrl, songUrl: url, duration: parseInt(info.videoDetails.lengthSeconds), sessionID, error: ""}
}

function clearText(text) {
	const source = typeof text === 'string' || text instanceof String ? text : '';
	return source.replace(/[[/\]{}()*+?.,\\^$|#\"]/g, '');
}

async function downloadThumbnail(info){
    console.log('Thumbnail download started')

    const options = {
        url: info.thumbnailUrl,
        dest: info.sessionDir+'thumbnail.jpg'               
    }

    const filenameOB = await download.image(options)
    console.log('Thumbnail downloaded')  
    return filenameOB.filename
}

function setTags(image_path, info){
    console.log('Setting tags')
    const tags = {
        title: info.songTitle,
        artist: info.artist,
        APIC: image_path,
    }
    
    NodeID3.write(tags, info.songPath, (err) => console.log(err))
    console.log('Tags are set')
}

const convertWebmToMp3 = (info) => { 
    return new Promise((resolve, reject) => {
        console.log('conversion started!')
        const ffmpegProcess =  cp.spawn(ffmpeg, [
            '-i',
            info.sessionDir+'ytsong.webm',
            '-ss',
            info.start_time,
            '-t',
            info.end_time - info.start_time,
            '-b:a',
            info.bitrate,
            info.songPath
        ]);

        ffmpegProcess.on('close', () => {
            console.log('conversion done');
            resolve()
        });
    });
}

async function downloadSong(info, res){
    createDir(info.sessionDir)
    console.log(info)

    // ytdl-core version - too slow becouse google sucks :(
    // ytdl(info.songUrl, { quality: 'highestaudio' }).pipe(fs.createWriteStream(info.sessionDir+'ytsong.webm')).on("finish", () => {
    //     console.log("Song download finished!");
    //     preprocessSong(info)
    //         .then((info) => {
    //             console.log('info', info.songPath)
    //             console.log(fs.existsSync(info.songPath))

    //             res.set({
    //                 "Access-Control-Allow-Origin": "*",
    //             })
    //             res.json(info)
    //         })
    // });

    const request = {
        url: info.songUrl,
        sessionDir: info.sessionDir
    }

    axios({
        url: ytdlp_endpoint,
        method: 'POST',
        responseType: 'stream',
        data: request
    }).then(function (response) {
        response.data.pipe(fs.createWriteStream(`${info.sessionDir}/ytsong.webm`));
        preprocessSong(info)
            .then((info) => {
                console.log('info', info.songPath)
                console.log(fs.existsSync(info.songPath))

                res.set({
                    "Access-Control-Allow-Origin": "*",
                })
                res.json(info)
            })
    })
}


async function preprocessSong(info){
    await convertWebmToMp3(info);

    const imagePath = await downloadThumbnail(info);
    setTags(imagePath, info)
    console.log(info.songPath);

    return info
}

function secondsToTime(secondsStr) {
    let seconds = parseInt(secondsStr)
    let timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);
    if (seconds < 3600) 
        timeStr = timeStr.substring(3, timeStr.length);

    if (seconds < 600) 
        timeStr = timeStr.substring(1, timeStr.length);

    return timeStr;
}


function generateSessionID(len) {
    const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < len; i++) {
        var randomPoz = Math.floor(Math.random() * charSet.length);
        id += charSet.substring(randomPoz,randomPoz+1);
    }
    return id;
}

function createDir(dir){
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
}

module.exports = {
    downloadSong: downloadSong,
    getInfo: getInfo
}